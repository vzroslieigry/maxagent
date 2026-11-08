# Contributing an experience pack

[Русский](CONTRIBUTING.ru.md)

A pack is a folder of short, tested recipes ("atoms") that other people's agents can use. Every pack is reviewed by the maintainer before it reaches anyone.

## 1. Prepare

Put the atoms you want to share in one folder, then run:

```
npx maxagent experience share <folder> --name <pack-name> --title "What this pack is about"
```

It checks the format, secrets, planted commands and anything personal (home folders, e-mail addresses, internal IPs, your user and computer names). If something is found, it lists the lines and writes nothing. If all is clean, it creates `maxagent-pack-<pack-name>/packs/src/<pack-name>/`.

**Nothing is sent anywhere by this command.** Read the files yourself: the check cannot understand context, such as a client's name in plain words.

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
