/**
 * Mapping from currency symbols to their icon filenames.
 * Icons are SVG files in this directory.
 */
export const symbolToIconMap: Record<string, string> = {
    '$': 'dollar',
    '$U': 'dollar-u',
    '.د.ب': 'dinar-bahrain',
    'Ar': 'ariary',
    'B/.': 'balboa',
    'BZ$': 'dollar-belize',
    'Br': 'birr',
    'Bs.': 'boliviano',
    'Bs.S': 'bolivar',
    'C$': 'cordoba',
    'CF': 'franc-comoro',
    'CFA': 'franc-cfa',
    'CHF': 'franc-swiss',
    'D': 'dalasi',
    'DT': 'dinar-tunisian',
    'Db': 'dobra',
    'FBu': 'franc-burundi',
    'FC': 'franc-congolese',
    'FG': 'franc-guinea',
    'FJ$': 'dollar-fiji',
    'Fdj': 'franc-djibouti',
    'Ft': 'forint',
    'G': 'gourde',
    'GH₵': 'cedi',
    'HK$': 'dollar-hongkong',
    'J$': 'dollar-jamaica',
    'JD': 'dinar-jordan',
    'K': 'kina',
    'KD': 'dinar-kuwait',
    'KM': 'mark-bosnia',
    'KSh': 'shilling-kenya',
    'Kz': 'kwanza',
    'Kč': 'koruna',
    'L': 'lempira',
    'LD': 'dinar-libya',
    'MAD': 'dirham-morocco',
    'MK': 'kwacha-malawi',
    'MOP$': 'pataca',
    'MT': 'metical',
    'NT$': 'dollar-taiwan',
    'Nu.': 'ngultrum',
    'P': 'pula',
    'Q': 'quetzal',
    'R': 'rand',
    'R$': 'real',
    'RD$': 'peso-dominican',
    'RM': 'ringgit',
    'Rf': 'rufiyaa',
    'Rp': 'rupiah',
    'Rs': 'rupee',
    'R₣': 'franc-rwanda',
    'S': 'shilling-somali',
    'S$': 'dollar-singapore',
    'S/.': 'sol',
    'SM': 'somoni',
    'T': 'manat',
    'T$': 'paanga',
    'TSh': 'shilling-tanzania',
    'TT$': 'dollar-trinidad',
    'UM': 'ouguiya',
    'USh': 'shilling-uganda',
    'ZK': 'kwacha-zambia',
    'kr': 'krone',
    'lei': 'leu',
    'zł': 'zloty',
    '£': 'pound',
    '¥': 'yen',
    'ƒ': 'florin',
    'ден': 'denar',
    'дин.': 'dinar-serbian',
    'лв': 'lev',
    '֏': 'dram',
    '؋': 'afghani',
    'ج.س.': 'pound-sudanese',
    'د.إ': 'dirham-uae',
    'د.ج': 'dinar-algerian',
    'د.ع': 'dinar-iraqi',
    'ل.ل.': 'pound-lebanese',
    '৳': 'taka',
    '฿': 'baht',
    '៛': 'riel',
    '₡': 'colon',
    '₣': 'franc-cfp',
    '₦': 'naira',
    '₨': 'rupee-alt',
    '₩': 'won',
    '₪': 'shekel',
    '₫': 'dong',
    '€': 'euro',
    '₭': 'kip',
    '₱': 'peso',
    '₲': 'guarani',
    '₴': 'hryvnia',
    '₸': 'tenge',
    '₹': 'rupee-indian',
    '₺': 'lira',
    '₽': 'ruble',
    '₾': 'lari',
    '﷼': 'rial',
};

/**
 * Get the icon filename for a given currency symbol.
 * @param symbol - The currency symbol (e.g., '$', '€', '£')
 * @returns The icon filename without extension (e.g., 'dollar', 'euro', 'pound')
 */
export function getIconForSymbol(symbol: string): string | undefined {
    return symbolToIconMap[symbol];
}

/**
 * Get the full icon path for a given currency symbol.
 * @param symbol - The currency symbol
 * @returns The full path to the SVG icon, or undefined if not found
 */
export function getIconPathForSymbol(symbol: string): string | undefined {
    const iconName = symbolToIconMap[symbol];
    if (!iconName) return undefined;
    return `/src/assets/currency-icons/${iconName}.svg`;
}
