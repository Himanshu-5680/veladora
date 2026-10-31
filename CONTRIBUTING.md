# Contributing

Veladora is a small static site on purpose. A pull request that adds a build step, an account, or a server has to explain why the tree still cannot leave the browser.

## Run it

```bash
npm test
npx serve .
```

Open the printed URL. `file://` will not load the modules.

## Add a check

1. Put the rule in `js/analyzer.js` and a line in `RULES`.
2. Add two fixtures in `test/engine.test.js`: one that must light, one that must stay dark.
3. Keep secret text out of `evidence` and out of `brief`. Store the raw match only on `localValue`.
4. Run `npm test`.

A good quiet fixture is `password = "changeme"`, a comment that mentions `eval`, or a file under `node_modules`.

## The model

`js/worker.js` is plain JavaScript served as-is. Do not bundle it. Transformers.js is imported from a pinned jsDelivr URL so a bundler cannot rewrite the worker into something the browser will not run.

Gemma is WebGPU and `q4f16` only. Do not add a silent fallback that downloads the gigabyte WASM build.

## Sample data

The AWS strings in `js/samples.js` are the public documentation examples. Do not replace them with anything that looks like a live token. GitHub push protection will block the push, and it should.
