import os
from openai import OpenAI
client = OpenAI(api_key=os.environ['NVIDIA_API_KEY'], base_url='https://integrate.api.nvidia.com/v1')
print(client.chat.completions.create(model='nvidia/llama-3.1-nemotron-70b-instruct', messages=[{'role': 'user', 'content': 'hi'}], max_tokens=10).choices[0].message.content)
