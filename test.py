import random
import textwrap
from pathlib import Path

import ollama
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas


OUTPUT_DIR = Path("generated_pdfs")
OUTPUT_DIR.mkdir(exist_ok=True)

MODEL = "kimi-k2.6:cloud"


def generate_words(word_count=500):
    prompt = (
        f"Generate exactly {word_count} random English words separated by spaces. "
        "Do not number them. Do not explain anything. "
        "Only output the words."
    )

    response = ollama.chat(
        model=MODEL,
        messages=[
            {
                "role": "user",
                "content": prompt,
            }
        ],
    )

    return response["message"]["content"]


def save_pdf(text, filename):
    c = canvas.Canvas(str(filename), pagesize=letter)
    width, height = letter

    margin = 50
    y = height - margin

    wrapped = textwrap.wrap(text, width=80)

    for line in wrapped:
        c.drawString(margin, y, line)
        y -= 14

        if y < margin:
            c.showPage()
            y = height - margin

    c.save()


def main():
    num_pdfs = 10

    for i in range(num_pdfs):
        print(f"Generating PDF {i + 1}/{num_pdfs}...")

        words = generate_words(random.randint(300, 800))

        filename = OUTPUT_DIR / f"random_words_{i+1:03}.pdf"
        save_pdf(words, filename)

    print("Done!")


if __name__ == "__main__":
    main()