# Instructions for GitHub Copilot coding agent

- Follow SOLID principles and clean architecture.
- Follow DRY principle - avoid code duplication.
- Follow YAGNI principle - don't implement unused features.
- When implementing a class/method or updating it, after implementation read the whole class and its package again to ensure it follows best practices (SOLID, DRY, YAGNI) and is clean.
- Extract common logic into reusable functions or classes.
- When you need new types/interfaces, define them in a dedicated `types` or `interfaces` file. But before that, check if similar types/interfaces already exist.
- Check existing service patterns (especially message-service for complete examples).
- Before implementing ask any clarifying questions if requirements are ambiguous or missing.
