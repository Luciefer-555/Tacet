import base64
import io
import os
import re
from typing import List, Tuple

import fitz  # PyMuPDF
import pytesseract
from PIL import Image
from pptx import Presentation
from docx import Document as DocxDocument
from openai import OpenAI

# Add tesseract cmd path as fallback
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

from agents import llm_config  # reuse the same NVIDIA config as Seashell/Shellfish

VISION_MODEL = "meta/llama-3.2-11b-vision-instruct"

_vision_client = OpenAI(
    api_key=llm_config["config_list"][0]["api_key"],
    base_url=llm_config["config_list"][0]["base_url"],
)


def is_sufficient(text: str, min_words: int = 15) -> bool:
    """Heuristic: does this text look like real, meaningful content?"""
    if not text:
        return False
    words = re.findall(r"\w+", text)
    return len(words) >= min_words


def image_to_base64(img: Image.Image) -> str:
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def vision_describe(img: Image.Image, context_hint: str = "") -> str:
    """Escalate to the vision model — used for diagrams/flowcharts/architecture drawings."""
    print("[Sand Flea] Escalating to VISION MODEL...", flush=True)
    b64 = image_to_base64(img)
    prompt = (
        "Describe this image in detail, focused on any technical content: "
        "if it's a flowchart, explain the steps and logic flow; if it's a system "
        "architecture diagram, explain the components and how they connect; "
        "if it's a chart/graph, explain what it shows. Be specific and thorough."
        + (f" Context: {context_hint}" if context_hint else "")
    )
    response = _vision_client.chat.completions.create(
        model=VISION_MODEL,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}},
                ],
            }
        ],
        max_tokens=512,
    )
    return response.choices[0].message.content


def run_tesseract(img: Image.Image) -> str:
    print("[Sand Flea] Running TESSERACT OCR...", flush=True)
    try:
        text = pytesseract.image_to_string(img).strip()
        print(f"[Sand Flea] Tesseract raw output: {text!r}", flush=True)
        return text
    except Exception as e:
        print(f"[Sand Flea] Tesseract failed: {e}", flush=True)
        return ""


def extract_from_image_bytes(file_bytes: bytes) -> str:
    img = Image.open(io.BytesIO(file_bytes))
    ocr_text = run_tesseract(img)
    if is_sufficient(ocr_text):
        return ocr_text
    # OCR found little/nothing meaningful — likely a diagram/flowchart, escalate to vision
    return vision_describe(img)


def extract_from_pdf_bytes(file_bytes: bytes) -> str:
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    results = []

    for page_num, page in enumerate(doc):
        page_text = page.get_text().strip()

        if is_sufficient(page_text):
            results.append(page_text)
            continue

        # Insufficient text layer — render page to image and try OCR, then vision
        pix = page.get_pixmap(dpi=150)
        img = Image.open(io.BytesIO(pix.tobytes("png")))

        ocr_text = run_tesseract(img)
        if is_sufficient(ocr_text):
            results.append(ocr_text)
        else:
            # Likely a diagram, flowchart, or scanned figure — escalate to vision
            description = vision_describe(img, context_hint=f"Page {page_num + 1} of a document")
            results.append(f"[Page {page_num + 1} - visual content]: {description}")

    doc.close()
    return "\n\n".join(results)


def extract_from_pptx_bytes(file_bytes: bytes) -> str:
    prs = Presentation(io.BytesIO(file_bytes))
    results = []

    for slide_num, slide in enumerate(prs.slides):
        slide_text_parts = []
        embedded_images = []

        for shape in slide.shapes:
            if shape.has_text_frame and shape.text_frame.text.strip():
                slide_text_parts.append(shape.text_frame.text.strip())
            if shape.shape_type == 13:  # MSO_SHAPE_TYPE.PICTURE
                try:
                    image_bytes = shape.image.blob
                    embedded_images.append(Image.open(io.BytesIO(image_bytes)))
                except Exception as e:
                    print(f"[Sand Flea] Failed to extract image from slide {slide_num + 1}: {e}", flush=True)

        slide_text = "\n".join(slide_text_parts)
        results.append(f"[Slide {slide_num + 1} text]: {slide_text}" if slide_text else f"[Slide {slide_num + 1}]: (no text)")

        for img_idx, img in enumerate(embedded_images):
            description = vision_describe(img, context_hint=f"Slide {slide_num + 1} of a presentation")
            results.append(f"[Slide {slide_num + 1}, image {img_idx + 1}]: {description}")

    return "\n\n".join(results)


def extract_from_docx_bytes(file_bytes: bytes) -> str:
    doc = DocxDocument(io.BytesIO(file_bytes))
    paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
    text = "\n".join(paragraphs)

    # DOCX embedded images are harder to reliably map to context — extract them
    # generically and describe, appended after the main text.
    image_descriptions = []
    for rel in doc.part.rels.values():
        if "image" in rel.reltype:
            try:
                img = Image.open(io.BytesIO(rel.target_part.blob))
                image_descriptions.append(vision_describe(img, context_hint="Embedded image in a document"))
            except Exception as e:
                print(f"[Sand Flea] Failed to extract embedded DOCX image: {e}", flush=True)

    if image_descriptions:
        text += "\n\n[Embedded images]:\n" + "\n".join(image_descriptions)

    return text


def extract_document(file_bytes: bytes, file_type: str) -> str:
    """
    Main entry point — Sand Flea's routing logic.
    file_type: one of 'pdf', 'pptx', 'docx', 'png', 'jpg', 'jpeg'
    """
    file_type = file_type.lower().lstrip(".")

    if file_type == "pdf":
        return extract_from_pdf_bytes(file_bytes)
    elif file_type == "pptx":
        return extract_from_pptx_bytes(file_bytes)
    elif file_type == "docx":
        return extract_from_docx_bytes(file_bytes)
    elif file_type in ("png", "jpg", "jpeg"):
        return extract_from_image_bytes(file_bytes)
    else:
        raise ValueError(f"Unsupported file type: {file_type}")
