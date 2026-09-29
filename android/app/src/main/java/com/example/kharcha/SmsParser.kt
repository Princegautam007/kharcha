package com.example.kharcha

object SmsParser {
    data class Transaction(
        val amount: Double,
        val type: String,
        val merchant: String,
        val category: String,
        val bank: String?
    )

    private data class BankRule(
        val keys: List<String>,
        val name: String
    )

    private val amountPatterns = listOf(
        Regex("""(?:rs\.?|inr|rupees?)\s*([\d,]+(?:\.\d{1,2})?)""", RegexOption.IGNORE_CASE),
        Regex("""([\d,]+(?:\.\d{1,2})?)\s*(?:rs\.?|inr|rupees?)""", RegexOption.IGNORE_CASE),
        Regex("""(?:debited|credited|paid|spent|transferred|withdrawn|withdrawal)\D+([\d,]+(?:\.\d{1,2})?)""", RegexOption.IGNORE_CASE)
    )

    private val merchantPatterns = listOf(
        Regex("""\b([A-Za-z0-9._-]{2,60}@[A-Za-z0-9._-]{2,30})\b""", RegexOption.IGNORE_CASE),
        Regex(
            """(?:VPA|UPI ID)[:\s]+([A-Za-z0-9._-]{2,60}@[A-Za-z0-9._-]{2,30})""",
            RegexOption.IGNORE_CASE
        ),
        Regex(
            """(?:refund(?:ed)?|cashback|reversal).{0,50}?(?:from|by|at)\s+([A-Za-z][A-Za-z0-9 &'._-]{1,49}?)(?=\s+(?:on|via|using|ref|upi|utr|a/c|acct|ending|and|to|from)\b|[.,;]|$)""",
            RegexOption.IGNORE_CASE
        ),
        Regex(
            """(?:paid to|payment to|sent to|transferred to|to)\s+([A-Za-z][A-Za-z0-9 &'._@-]{1,49}?)(?=\s+(?:on|via|using|ref|upi|utr|a/c|acct|account|from)\b|[.,;]|$)""",
            RegexOption.IGNORE_CASE
        ),
        Regex(
            """(?:at|for|towards|merchant|store)\s*[:\s]+([A-Za-z][A-Za-z0-9 &'._@-]{1,49}?)(?=\s+(?:on|via|using|ref|upi|utr|a/c|acct|account|from)\b|[.,;]|$)""",
            RegexOption.IGNORE_CASE
        )
    )

    private val bankRules = listOf(
        BankRule(listOf("canara bank", "canbnk", "canara", "cnrb"), "Canara Bank"),
        BankRule(listOf("indian overseas bank", "iobank", "iob"), "Indian Overseas Bank"),
        BankRule(listOf("uco bank", "ucobk", "uco"), "UCO Bank"),
        BankRule(listOf("idfc first bank", "idfc first", "idfcfb", "idfc"), "IDFC First Bank"),
        BankRule(listOf("bank of baroda", "bob", "baroda"), "BOB"),
        BankRule(listOf("hdfc", "hdfcbk"), "HDFC"),
        BankRule(listOf("sbi", "sbiinb"), "SBI"),
        BankRule(listOf("icici", "icicib"), "ICICI"),
        BankRule(listOf("axis", "axisbk"), "Axis"),
        BankRule(listOf("kotak"), "Kotak"),
        BankRule(listOf("pnb"), "PNB"),
        BankRule(listOf("paytm", "pytm"), "Paytm"),
        BankRule(listOf("phonepe", "phonpe"), "PhonePe"),
        BankRule(listOf("gpay", "google pay"), "GPay"),
        BankRule(listOf("yes bank"), "Yes Bank"),
        BankRule(listOf("federal"), "Federal"),
        BankRule(listOf("union bank", "union"), "Union Bank")
    )

    fun parse(body: String?, senderId: String? = null): Transaction? {
        if (body.isNullOrBlank()) return null

        val text = body.trim()
        val lower = text.lowercase()
        val sender = senderId.orEmpty().lowercase()

        if (Regex("""\botp\b|\bpassword\b|\bverif""").containsMatchIn(text)) return null

        val amount = amountPatterns.firstNotNullOfOrNull { pattern ->
            pattern.find(text)?.groupValues?.getOrNull(1)?.replace(",", "")?.toDoubleOrNull()
        } ?: return null

        if (amount <= 0.0) return null

        val looksLikeTransaction = Regex(
            """\b(debited|credited|paid|spent|purchase|payment|debit|credit|dr|received|transferred|withdrawn|withdrawal|refund(?:ed)?|reversal|reversed)\b|cash\s+withdrawal|\batm\b""",
            RegexOption.IGNORE_CASE
        ).containsMatchIn(text)

        if (!looksLikeTransaction) return null

        val type = when {
            Regex("""debited|spent|paid|purchase|payment|debit|\bdr\b|cash\s*withdrawal|withdrawn|withdrawal|atm""", RegexOption.IGNORE_CASE)
                .containsMatchIn(text) -> "debit"
            Regex("""credited|received|credit|\bcr\b|cashback.*(?:credited|received)|refund|refunded|reversal|reversed""", RegexOption.IGNORE_CASE)
                .containsMatchIn(text) -> "credit"
            else -> "debit"
        }

        val merchant = extractMerchant(text)
        val bank = detectBank(lower, sender)
        val category = categoryFor(merchant)

        return Transaction(
            amount = amount,
            type = type,
            merchant = merchant ?: if (bank != null) "$bank Transaction" else "Unknown",
            category = category,
            bank = bank
        )
    }

    private fun extractMerchant(text: String): String? {
        for (pattern in merchantPatterns) {
            val match = pattern.find(text) ?: continue
            val candidate = match.groupValues[1].trim().trimEnd('.', ',', ';')
            if (candidate.isBlank()) continue
            if (Regex("""^(your\s+)?(?:account|a/c|acct)$""", RegexOption.IGNORE_CASE).matches(candidate)) continue
            return candidate
        }
        return null
    }

    private fun detectBank(lowerText: String, lowerSender: String): String? {
        for (rule in bankRules) {
            for (key in rule.keys) {
                if (lowerSender.contains(key)) return rule.name
                val escaped = Regex.escape(key)
                if (Regex("""(?:^|[^a-z0-9])$escaped(?:[^a-z0-9]|$)""", RegexOption.IGNORE_CASE).containsMatchIn(lowerText)) {
                    return rule.name
                }
            }
        }
        return null
    }

    private fun categoryFor(merchant: String?): String {
        if (merchant.isNullOrBlank()) return "other"

        val lower = merchant.lowercase()

        return when {
            Regex("""swiggy|zomato|mcdonald|kfc|domino|pizza hut|pizza|cafe|restaurant|eat|biryani|dhaba|food|starbucks|subway|burger king|chaayos|haldiram""")
                .containsMatchIn(lower) -> "food"

            Regex("""blinkit|zepto|bigbasket|grofers|dmart|jiomart|instamart|reliance fresh|more supermarket|nature'?s basket|grocery|kirana|supermart""")
                .containsMatchIn(lower) -> "groceries"

            Regex("""ola|uber|rapido|indrive|blu smart|metro|irctc|makemytrip|cleartrip|easemytrip|redbus|train|flight|bus|cab|auto|parking|fastag|toll""")
                .containsMatchIn(lower) -> "transport"

            Regex("""amazon|flipkart|myntra|ajio|meesho|nykaa|croma|reliance digital|decathlon|ikea|tata cliq|shop|mall|store|fashion|clothes""")
                .containsMatchIn(lower) -> "shopping"

            Regex("""jio|airtel|bsnl|vi |vodafone|electricity|water|gas|bill|recharge|netflix|hotstar|prime video|spotify|youtube premium|broadband|d2h|insurance""")
                .containsMatchIn(lower) -> "bills"

            Regex("""apollo|medplus|pharmeasy|tata 1mg|1mg|netmeds|pharma|hospital|clinic|practo|doctor|medicine|health|med""")
                .containsMatchIn(lower) -> "health"

            Regex("""petrol|diesel|fuel|hp |iocl|indian oil|hpcl|bpcl|bharat petroleum|nayara|reliance petroleum|shell""")
                .containsMatchIn(lower) -> "fuel"

            else -> "other"
        }
    }
}
