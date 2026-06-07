Please change completely how this project works. First major change, collaboration shouldn't be mandatory. Secondly, this should be a tauri app frontend, and an optional server.

People should be able to open a folder in openmd, edit files and content, create a live share server with other people (somehow that doesn't require port forwarding, maybe like how coolify generates domains?)
There should then be a seperate server, which can be set to constantly sync a folder, that people can join and edit and leave whenever they want.

When openmd is opened after being closed, there should at first be a small window, similar to how obsidian looks (don't copy colors and such, just the _concept_), where on the left sidebar there should be a list of recent projects, wether that be connecting to a previous server or live share, or being a local folder.

In the main body, there should be a "openmd" title, a version number, and below that:

1. Create new project

- Creates a new folder somewhere the user chooses, with a precreated small projects with (set up as a folder structure):

```
/
├─ "project" folder
│   ├─ "_frontmatter.md" file with sample title, subtitle, author
│   └─ "chapter-1.md" With "### Hello openmd! \n Welcome to openmd."
└─ "other" folder
```

2. Open folder as project
3. Connect to server

In order to minimize duplication code, please make single player also act as the same server, but just with no collaborators, like how singleplayer minecraft worlds work
