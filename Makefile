.PHONY: test lint

test: lint
	node --test tests/releases.test.cjs

lint:
	node --check tests/releases.test.cjs
	git diff --check -- .
