## Summary

Describe what this PR changes and why. Keep it to a few sentences.

## Linked issue

Closes #

## Checklist

- [ ] Tests pass locally: `cd pwa && npm test`, plus `python -m unittest discover -s tests` if Python code changed
- [ ] Accessibility checked: new controls are keyboard reachable, dynamic updates announce through `aria-live`, and `npm run test:a11y` passes
- [ ] Docs updated (README, `docs/`, or module-level comments) where behavior changed
- [ ] No secrets leaked: no `VITE_`-prefixed secrets, no keys in the diff, `npm run check-env` passes
- [ ] Linked issue included above
