.PHONY: build test lint

build:
	node scripts/build.cjs

test: lint
	node scripts/build.cjs --check
	node --test tests/*.test.cjs

lint:
	node --check scripts/build.cjs
	node --check tests/releases.test.cjs
	node --check tests/pages.test.cjs
	git diff --check -- .
