# Taste (Continuously Learned by [CommandCode][cmd])

[cmd]: https://commandcode.ai/


# frontend
- All UI text, error messages, and user-facing content must be 100% Vietnamese — translate backend error messages to Vietnamese. Confidence: 0.85
- Keep UI minimal/simple for testing (user is not responsible for frontend). Confidence: 0.75

# naming
- Use "giờ đào tạo" (training hours) instead of "CME" in all UI labels, code identifiers, and documentation. Confidence: 0.85

# workflow
- Document plans in docs first before implementing. Confidence: 0.80
- Store review and analysis documents in developer_docs directory. Confidence: 0.70

# categorization
- Organize question categories by lesson (Bài 1-9) — all questions from a single uploaded document share one lesson-based category instead of scattered small categories. Confidence: 0.70
