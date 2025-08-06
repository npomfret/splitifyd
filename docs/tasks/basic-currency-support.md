# Task: Basic Multi-Currency Support

## Description

To better support users who travel or live in different countries, the application needs to handle expenses in multiple currencies. This task covers the initial implementation of multi-currency support, focusing on tracking and balancing expenses on a per-currency basis without automatic conversion.

## Requirements

### 1. Expense Creation

-   When creating or editing an expense, the user must be able to select a currency for the amount.
-   The application will support the following currencies, which are provided by the 1Forge API:
    -   AED - United Arab Emirates dirham
    -   AFN - Afghan afghani
    -   ALL - Albanian lek
    -   AMD - Armenian dram
    -   ANG - Netherlands Antillean guilder
    -   AOA - Angolan kwanza
    -   ARE - AREG
    -   ARS - Argentine peso
    -   AUD - Australian dollar
    -   AUN - Australian nugget
    -   AWG - Aruban florin
    -   BAM - Bosnia and Herzegovina convertible mark
    -   BBD - Barbados dollar
    -   BDT - Bangladeshi taka
    -   BGN - Bulgarian lev
    -   BHD - Bahraini dinar
    -   BIF - Burundian franc
    -   BMD - Bermudian dollar
    -   BND - Brunei dollar
    -   BOB - Boliviano
    -   BRI - Britannia
    -   BRL - Brazilian real
    -   BSD - Bahamian dollar
    -   BTN - Bhutanese ngultrum
    -   BWP - Botswana pula
    -   BYN - Belarusian ruble
    -   BZD - Belize dollar
    -   CAD - Canadian dollar
    -   CDF - Congolese franc
    -   CHF - Swiss franc
    -   CLF - Chilean Unit of Account
    -   CLP - Chilean peso
    -   CNH - Chinese yuan
    -   CNY - Chinese yuan
    -   COP - Colombian peso
    -   CRC - Costa Rican colon
    -   CUP - Cuban peso
    -   CVE - Cape Verde escudo
    -   CYP - Cypriot pound
    -   CZK - Czech koruna
    -   DJF - Djiboutian franc
    -   DKK - Danish krone
    -   DOE - Double Eagle
    -   DOP - Dominican peso
    -   DZD - Algerian dinar
    -   EGP - Egyptian pound
    -   ETB - Ethiopian birr
    -   EUR - Euro
    -   FJD - Fiji dollar
    -   FRN - French Napoleon
    -   GBP - Pound sterling
    -   GEL - Georgian lari
    -   GHS - Ghanaian cedi
    -   GMD - Gambian dalasi
    -   GNF - Guinean franc
    -   GTQ - Guatemalan quetzal
    -   GYD - Guyanese dollar
    -   HKD - Hong Kong dollar
    -   HNL - Honduran lempira
    -   HRK - Croatian kuna
    -   HTG - Haitian gourde
    -   HUF - Hungarian forint
    -   IDR - Indonesian rupiah
    -   ILS - Israeli new shekel
    -   INR - Indian rupee
    -   IQD - Iraqi dinar
    -   IRR - Iranian rial
    -   ISK - Icelandic króna
    -   JMD - Jamaican dollar
    -   JOD - Jordanian dinar
    -   JPY - Japanese yen
    -   KES - Kenyan shilling
    -   KHR - Cambodian riel
    -   KMF - Comoro franc
    -   KRU - South African Krugerrand
    -   KRW - South Korean won
    -   KWD - Kuwaiti dinar
    -   KYD - Cayman Islands dollar
    -   KZT - Kazakhstani tenge
    -   LAK - Lao kip
    -   LBP - Lebanese pound
    -   LFX - Khazanah Sukuk
    -   LKR - Sri Lankan rupee
    -   LRD - Liberian dollar
    -   LSL - Lesotho loti
    -   LTL - Lithuanian litas
    -   LYD - Libyan dinar
    -   M5P - Mexican 50 peso
    -   MAD - Moroccan dirham
    -   MAL - Maple Leaf
    -   MDL - Moldovan leu
    -   MGA - Malagasy ariary
    -   MKD - Macedonian denar
    -   MMK - Myanma kyat
    -   MOP - Macanese pataca
    -   MRU - Mauritanian Ouguiya
    -   MTL - Maltese lira
    -   MUR - Mauritian rupee
    -   MVR - Maldivian rufiyaa
    -   MWK - Malawian kwacha
    -   MXN - Mexican peso
    -   MYR - Malaysian ringgit
    -   MZN - Mozambican metical
    -   NAD - Namibian dollar
    -   NBL - Isle Of Man noble
    -   NGN - Nigerian naira
    -   NIO - Nicaraguan córdoba
    -   NOK - Norwegian krone
    -   NPR - Nepalese rupee
    -   NSO - New Sovereign
    -   NZD - New Zealand dollar
    -   OMR - Omani rial
    -   OSO - Old Sovereign
    -   PAB - Panamanian balboa
    -   PEN - Peruvian nuevo sol
    -   PGK - Papua New Guinean kina
    -   PHP - Philippine peso
    -   PKR - Pakistani rupee
    -   PLN - Polish złoty
    -   PYG - Paraguayan guaraní
    -   QAR - Qatari riyal
    -   RON - Romanian new leu
    -   RSD - Serbian dinar
    -   RUB - Russian rouble
    -   RWF - Rwandan franc
    -   SAR - Saudi riyal
    -   SBD - Solomon Islands dollar
    -   SCR - Seychelles rupee
    -   SDG - Sudanese pound
    -   SEK - Swedish krona
    -   SGD - Singapore dollar
    -   SHP - Saint Helena pound
    -   SLL - Sierra Leonean leone
    -   SOS - Somali shilling
    -   SRD - Surinamese dollar
    -   STN - Sao Tomean Dobra
    -   SVC - Salvadoran colón
    -   SZL - Swazi lilangeni
    -   THB - Thai baht
    -   TJS - Tajikistani somoni
    -   TMT - Turkmenistani manat
    -   TND - Tunisian dinar
    -   TOP - Tongan paʻanga
    -   TRY - Turkish lira
    -   TTD - Trinidad and Tobago dollar
    -   TWD - New Taiwan dollar
    -   TZS - Tanzanian shilling
    -   UAH - Ukrainian hryvnia
    -   UGX - Ugandan shilling
    -   USD - United States dollar
    -   UYU - Uruguayan peso
    -   UZS - Uzbekistan som
    -   VES - Venezuelan Bolivar Soberano
    -   VND - Vietnamese dong
    -   VRL - Vreneli 10F.
    -   VRN - Vreneli 20F
    -   XAG - Silver (one troy ounce)
    -   XAGK - Silver (kg)
    -   XAU - Gold (one troy ounce)
    -   XAUK - Gold (kg)
    -   XCD - East Caribbean dollar
    -   XDR - Special drawing rights
    -   XOF - CFA Franc BCEAO
    -   XPD - Palladium (one troy ounce)
    -   XPDK - Palladium (kg)
    -   XPF - CFP franc
    -   XPT - Platinum (one troy ounce)
    -   XPTK - Platinum (kg)
    -   YER - Yemeni rial
    -   ZAR - South African Rand
    -   ZMW - Zambian kwacha
    -   ZWD - Zimbabwe dollar

### 2. Default Currency Logic

To make creating expenses faster, the currency field should have a smart default based on the following priority:

1.  **Last Used by User:** Default to the currency that the current user last used for an expense *within the current group*.
2.  **Last Used in Group:** If the current user has not created an expense in this group before, default to the currency that was last used by *any* member in the group.
3.  **Locale-Based Guess:** If it's the very first expense in a group, attempt to guess the user's local currency based on their browser's locale settings (e.g., `navigator.language`). USD should be the ultimate fallback.

### 3. Balance and Debt Calculation

-   All financial calculations must be currency-aware.
-   **No Automatic Conversion:** The application will not perform any foreign exchange (FX) conversions. All balances and debts will be maintained in their original currency.
-   **Per-Currency Balances:** The group balance summary and user balances on the dashboard must be displayed on a per-currency basis. For example, a user's balance might show "Owes $50 USD and is owed €20 EUR".
-   **Per-Currency Debt Simplification:** The "simplify debts" algorithm must operate independently for each currency. A user might owe another user in one currency and be owed by the same user in a different currency.

### 4. UI/UX Considerations

-   Clearly display the currency symbol or code next to all amounts throughout the application (expense lists, detail views, balance summaries).
-   The UI should be able to handle displaying multiple balance lines if a user has debts in more than one currency.
