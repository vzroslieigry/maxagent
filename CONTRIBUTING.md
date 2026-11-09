# Contributing an experience pack

[Русский](CONTRIBUTING.ru.md)

A pack is a folder of short, tested recipes ("atoms") that other people's agents can use. Every pack is reviewed by the maintainer before it reaches anyone.

## 1. Prepare

Put the atoms you want to share in one folder, then run:

```
npx maxagent experience share <folder> --name <pack-name> --title "What this pack is about"
```

It sorts atoms one by one and writes a draft with `SHARE-REPORT.md`: what fits, what must be rewritten and why, what is left out. Folders `owner`, `projects`, `answer` are never taken. **The command sends nothing anywhere.**

A pack holds only what is useful to anyone. An atom stays if all of these are true:
- it names a public tool, error or technique;
- a stranger can repeat the steps knowing nothing about you or your computer;
- it is knowledge about the tool, not about someone's setup or arrangements;
- it says what was verified.

Replace anything personal with a placeholder (`<project folder>`). If the tip loses its point without it, delete the atom. The easiest way is to ask your agent: "prepare an experience pack about ffmpeg". Then the final, strict check:

```
npx maxagent experience share --check <pack folder>
```

A program cannot tell that a client or private project name is personal, so read the result yourself.

## 2. Send

- **With git:** fork this repository, copy the folder into `packs/src/`, open a Pull Request.
- **Without git:** open an issue with the [pack submission form](../../issues/new?template=pack.yml) and attach the folder as a `.zip`.

To update an existing pack, change its files and raise `version` in its `pack.json`.

## 3. What is accepted

- Things that were actually done and worked; say what was verified in `- проверка:` / the source line.
- General knowledge about tools, errors and workflows that helps someone else.
- One task per atom, at most 900 characters. Format: `packages/maxagent/template/en/experience/_spec.md`.

## 4. What is not accepted

- Anything personal or private: names, accounts, servers, clients, keys, internal addresses.
- Text that tells an agent to download and run something, send data out, ignore its rules, or destroy files.
- Advertising, referral links, copied paid content.
- Untested guesses.

## 5. What happens next

CI checks the pack automatically. The maintainer reads it and merges or asks for changes. After a merge the release is built automatically (with search vectors) and appears in the catalog: `npx maxagent experience update`.

By contributing you agree that your pack is published under the MIT license of this repository.
