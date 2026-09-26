import tsParser from '@typescript-eslint/parser';
export default [{
  files:['src/config/commerce.ts','src/lib/reservation*.ts','src/lib/commerce-mail.ts','src/components/commerce/**/*.{ts,tsx}',
    'src/pages/api/reservations/**/*.ts','src/pages/api/commerce-*.ts','tests/reservations.test.ts',
    'src/lib/tshirt-promotion.ts','src/lib/emails.ts','src/pages/api/tshirt-lead.ts',
    'src/lib/admin-notifications.ts','tests/admin-notifications.test.ts','src/pages/api/stripe-webhook.ts','src/pages/api/create-checkout-session.ts',
    'src/lib/auth-*.ts','src/pages/api/auth/*.ts','tests/auth-forms.test.ts',
    'src/config/editorial.ts','src/lib/seo.ts','src/lib/article-seo.ts','src/pages/feed.xml.ts','src/pages/sitemap.xml.ts','tests/seo.test.ts','scripts/verify-seo.mjs'],
  languageOptions:{parser:tsParser,parserOptions:{ecmaFeatures:{jsx:true}},ecmaVersion:'latest',sourceType:'module'},
  rules:{'constructor-super':'error','for-direction':'error','getter-return':'error','no-async-promise-executor':'error','no-constant-binary-expression':'error',
    'no-debugger':'error','no-dupe-args':'error','no-dupe-else-if':'error','no-dupe-keys':'error','no-duplicate-case':'error','no-ex-assign':'error',
    'no-fallthrough':'error','no-invalid-regexp':'error','no-promise-executor-return':'error','no-unreachable':'error','no-unsafe-finally':'error',
    'no-unsafe-optional-chaining':'error','use-isnan':'error','valid-typeof':'error','eqeqeq':'error','no-var':'error'},
}];
