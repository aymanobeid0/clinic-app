import tseslint from 'typescript-eslint';
export default tseslint.config({ ignores: ['**/dist/**', '**/generated/**', 'design/**', '**/.claude/**', '**/.agents/**'] }, ...tseslint.configs.recommended, { rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] } });
