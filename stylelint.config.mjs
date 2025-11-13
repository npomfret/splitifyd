export default {
    extends: ['stylelint-config-standard'],
    ignoreFiles: ['**/node_modules/**', '**/dist/**', '**/.tmp/**'],
    rules: {
        'color-named': 'never',
        'declaration-no-important': true,
        'selector-max-id': 0,
        'no-duplicate-custom-properties': true,
    },
};
