"use client";

import { forwardRef, useImperativeHandle, useEffect, useState } from "react";

export type CardVariant = "dark" | "light";

interface CardTemplateProps {
  userName: string;
  variant: CardVariant;
  onTextureReady: (dataUrl: string) => void;
  city?: string;
  date?: string;
}

export interface CardTemplateRef {
  captureTexture: () => Promise<void>;
  exportCard: () => Promise<void> | void;
}

const CANVAS_SIZE = 1376;

const CardTemplate = forwardRef<CardTemplateRef, CardTemplateProps>(
  ({ userName, variant, onTextureReady, city, date }, ref) => {
    const [baseImage, setBaseImage] = useState<HTMLImageElement | null>(null);

    const imageSrc = variant === "dark" ? "/card-base-dark.png" : "/card-base-light.png";
    const textColor = variant === "dark" ? "#ffffff" : "#000000";

    // Preload the base card image
    useEffect(() => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => setBaseImage(img);
      img.src = imageSrc;
    }, [imageSrc]);

    const resolveCanvasFonts = async () => {
      if (typeof document !== "undefined" && document.fonts) {
        await document.fonts.ready;
        const style = getComputedStyle(document.documentElement);
        const displayFont = style.getPropertyValue('--font-display').trim() || 'Melodrame, "Instrument Serif", serif';
        const sansFont = style.getPropertyValue('--font-sans').trim() || 'Geist, sans-serif';
        const monoFont = style.getPropertyValue('--font-mono').trim() || '"Geist Mono", monospace';
        try {
          await Promise.all([
            document.fonts.load(`bold 76px ${displayFont}`),
            document.fonts.load(`500 34px ${sansFont}`),
            document.fonts.load(`normal 44px ${monoFont}`),
            document.fonts.load(`normal 48px ${monoFont}`),
            document.fonts.load(`normal 22px ${monoFont}`),
          ]);
        } catch (_) {}
        return { displayFont, sansFont, monoFont };
      }
      return {
        displayFont: 'Melodrame, "Instrument Serif", serif',
        sansFont: 'Geist, sans-serif',
        monoFont: '"Geist Mono", monospace',
      };
    };

    const captureTexture = async () => {
      const { displayFont, sansFont, monoFont } = await resolveCanvasFonts();
      const canvas = document.createElement("canvas");
      canvas.width = CANVAS_SIZE;
      canvas.height = CANVAS_SIZE;
      const ctx = canvas.getContext("2d");
      
      if (!ctx) return;

      // Draw base card image (fills entire canvas)
      if (baseImage) {
        ctx.drawImage(baseImage, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
      } else {
        // Fallback black background if image not loaded
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      }

      // Re-skin top-left branding: Blank out v0 logo / "Prompt to Production" and draw TACET
      ctx.fillStyle = variant === "dark" ? "#070708" : "#f4f4f5";
      ctx.fillRect(35, 40, 620, 270);

      ctx.fillStyle = textColor;
      ctx.font = `bold 76px ${displayFont}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText("TACET", 55, 145);

      ctx.fillStyle = variant === "dark" ? "#a1a1aa" : "#52525b";
      ctx.font = `500 34px ${sansFont}`;
      ctx.fillText("Problem to Hire", 55, 205);

      // Re-skin bottom-right attendee label: Blank out "ATTENDEE" and draw "STUDENT"
      ctx.fillStyle = variant === "dark" ? "#070708" : "#f4f4f5";
      ctx.fillRect(320, 850, 340, 110);

      ctx.fillStyle = "#878787";
      ctx.font = `normal 44px ${monoFont}`;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText("STUDENT", (CANVAS_SIZE / 2) - 55, 905);

      // Blank out back QR "POWERED BY VERCEL" label
      ctx.fillStyle = variant === "dark" ? "#0c0c0d" : "#ffffff";
      ctx.fillRect(800, 755, 440, 65);
      ctx.fillStyle = "#71717a";
      ctx.font = `normal 22px ${monoFont}`;
      ctx.textAlign = "center";
      ctx.fillText("TACET PLATFORM", 1020, 788);

      // Draw user name at the bottom left area (below the geometric pattern)
      const displayName = userName || "YOUR NAME";
      ctx.fillStyle = textColor;
      ctx.font = `normal 48px ${monoFont}`;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      
      const textX = (CANVAS_SIZE / 2) - 55;
      const textY = CANVAS_SIZE - 400;
      ctx.fillText(displayName.toUpperCase(), textX, textY);

      // Render city label
      if (city) {
        const cityRender = canvas.getContext("2d");

        if (!cityRender) return;

        cityRender.fillStyle = textColor;
        cityRender.font = 'normal 48px "Geist Mono", monospace';
        cityRender.textAlign = "right";
        cityRender.textBaseline = "middle";

        const cityTextX = (CANVAS_SIZE / 2) - 55;
        const cityTextY = CANVAS_SIZE - 1226;
        cityRender.fillText(city.toUpperCase(), cityTextX, cityTextY);
      }

      // Render date label
      if (date) {
        const dateRender = canvas.getContext("2d");

        if (!dateRender) return;

        dateRender.fillStyle = '#878787';
        dateRender.font = 'normal 48px "Geist Mono", monospace';
        dateRender.textAlign = "right";
        dateRender.textBaseline = "middle";

        const dateTextX = (CANVAS_SIZE / 2) - 55;
        const dateTextY = CANVAS_SIZE - 1170;
        dateRender.fillText(date.toUpperCase(), dateTextX, dateTextY);
      }

      const dataUrl = canvas.toDataURL("image/png");
      onTextureReady(dataUrl);
    };

    const exportCard = async () => {
      const { displayFont, sansFont, monoFont } = await resolveCanvasFonts();
      const CROP_BOTTOM = 334;
      const EXPORT_HEIGHT = CANVAS_SIZE - CROP_BOTTOM;

      // First, create a full-size canvas to draw the complete card
      const fullCanvas = document.createElement("canvas");
      fullCanvas.width = CANVAS_SIZE;
      fullCanvas.height = CANVAS_SIZE;
      const fullCtx = fullCanvas.getContext("2d");
      
      if (!fullCtx) return;

      // Draw base card image (fills entire canvas)
      if (baseImage) {
        fullCtx.drawImage(baseImage, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
      } else {
        // Fallback black background if image not loaded
        fullCtx.fillStyle = "#000000";
        fullCtx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      }

      // Re-skin top-left branding
      fullCtx.fillStyle = variant === "dark" ? "#070708" : "#f4f4f5";
      fullCtx.fillRect(35, 40, 620, 270);

      fullCtx.fillStyle = textColor;
      fullCtx.font = `bold 76px ${displayFont}`;
      fullCtx.textAlign = "left";
      fullCtx.textBaseline = "alphabetic";
      fullCtx.fillText("TACET", 55, 145);

      fullCtx.fillStyle = variant === "dark" ? "#a1a1aa" : "#52525b";
      fullCtx.font = `500 34px ${sansFont}`;
      fullCtx.fillText("Problem to Hire", 55, 205);

      // Re-skin bottom-right attendee label
      fullCtx.fillStyle = variant === "dark" ? "#070708" : "#f4f4f5";
      fullCtx.fillRect(320, 850, 340, 110);

      fullCtx.fillStyle = "#878787";
      fullCtx.font = `normal 44px ${monoFont}`;
      fullCtx.textAlign = "right";
      fullCtx.textBaseline = "middle";
      fullCtx.fillText("STUDENT", (CANVAS_SIZE / 2) - 55, 905);

      // Blank out back QR "POWERED BY VERCEL" label
      fullCtx.fillStyle = variant === "dark" ? "#0c0c0d" : "#ffffff";
      fullCtx.fillRect(800, 755, 440, 65);
      fullCtx.fillStyle = "#71717a";
      fullCtx.font = `normal 22px ${monoFont}`;
      fullCtx.textAlign = "center";
      fullCtx.fillText("TACET PLATFORM", 1020, 788);

      // Draw user name at the bottom left area (below the geometric pattern)
      const displayName = userName || "YOUR NAME";
      fullCtx.fillStyle = textColor;
      fullCtx.font = `normal 48px ${monoFont}`;
      fullCtx.textAlign = "right";
      fullCtx.textBaseline = "middle";
      
      const textX = (CANVAS_SIZE / 2) - 55;
      const textY = CANVAS_SIZE - 400;
      fullCtx.fillText(displayName.toUpperCase(), textX, textY);

      // Render city label
      if (city) {
        const cityRender = fullCanvas.getContext("2d");

        if (!cityRender) return;

        cityRender.fillStyle = textColor;
        cityRender.font = 'normal 48px "Geist Mono", monospace';
        cityRender.textAlign = "right";
        cityRender.textBaseline = "middle";

        const cityTextX = (CANVAS_SIZE / 2) - 55;
        const cityTextY = CANVAS_SIZE - 1226;
        cityRender.fillText(city.toUpperCase(), cityTextX, cityTextY);
      }

      // Render date label
      if (date) {
        const dateRender = fullCanvas.getContext("2d");

        if (!dateRender) return;

        dateRender.fillStyle = '#878787';
        dateRender.font = 'normal 48px "Geist Mono", monospace';
        dateRender.textAlign = "right";
        dateRender.textBaseline = "middle";

        const dateTextX = (CANVAS_SIZE / 2) - 55;
        const dateTextY = CANVAS_SIZE - 1170;
        dateRender.fillText(date.toUpperCase(), dateTextX, dateTextY);
      }

      // Create cropped export canvas (excludes bottom 334px)
      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = CANVAS_SIZE;
      exportCanvas.height = EXPORT_HEIGHT;
      const exportCtx = exportCanvas.getContext("2d");

      if (!exportCtx) return;

      // Copy the top portion of the full canvas to the export canvas
      exportCtx.drawImage(
        fullCanvas,
        0, 0, CANVAS_SIZE, EXPORT_HEIGHT, // Source: top portion
        0, 0, CANVAS_SIZE, EXPORT_HEIGHT  // Destination: same size
      );

      // Export at full resolution
      const dataUrl = exportCanvas.toDataURL("image/png", 1.0);
      const link = document.createElement("a");
      link.download = `tacet-card-${userName || "student"}.png`;
      link.href = dataUrl;
      link.click();
    };

    useImperativeHandle(ref, () => ({
      captureTexture,
      exportCard,
    }));

    // This component doesn't render anything visible
    return null;
  }
);

CardTemplate.displayName = "CardTemplate";

export default CardTemplate;
