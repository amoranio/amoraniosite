/* Edit this file.
   The editor tabs are drawn from the values below.
   about.json uses person. work.json uses work.
   skills.md uses skill, and the same person fields as about.json.
   links.lnk lists social, plus one shortcut for each project.
   The Extensions sidebar uses extensions. Those rows do not open anything.
   Add a string, a project, a profile, or an extension, then refresh.
   Use "" or null for a slot you want to leave blank. */

window.AMORAN_PROFILE = {
    person: {
        name: "Ashley Moran",
        handle: "amoranio",
        site: "https://amoran.io",
        // A place name, or null to leave the value as null.
        location: null,
        // EDIT: one sentence about you.
        summary: "EDIT: a sentence about you.",
        // EDIT: add or remove entries.
        currently: [
            "EDIT: what you are doing now"
        ],
        // EDIT: add a key, or add words to a list.
        interests: {
            building: ["products", "experiments", "browser games"],
            playing: ["platformers"]
        }
    },
    work: {
        // EDIT: what you are focused on.
        focus: "EDIT: what you are focused on right now.",
        // EDIT: append another { name, url, note } object.
        projects: [
            { name: "Exnoscan", url: "https://exnoscan.com", note: "EDIT: what Exnoscan is" },
            { name: "ClearQR", url: "https://clearqr.exnoscan.com", note: "EDIT: what ClearQR is" },
            { name: "badMCP", url: "https://amoranio.github.io/badMCP", note: "EDIT: what badMCP is" },
            { name: "amoran.io", url: "https://amoran.io", note: "This workspace. Block Runner is the open tab." }
        ]
    },
    // EDIT: the skill an agent would load. name and description are the front matter.
    // notes is optional. Leave "" to keep the edit comment in skills.md.
    skill: {
        name: "ashley-moran",
        description: "EDIT: when an agent should use this skill.",
        notes: ""
    },
    // EDIT: append another { name, handle, url } object.
    social: [
        { name: "LinkedIn", handle: "in/ashleymoran", url: "https://www.linkedin.com/in/ashleymoran" },
        { name: "X", handle: "@amoranio", url: "https://x.com/amoranio" },
        { name: "GitHub", handle: "amoranio", url: "https://github.com/amoranio" }
    ],
    // EDIT: append another { name, description, publisher } object.
    // These rows stay in the Extensions sidebar. They are not links.
    extensions: [
        { name: "Block Runner", description: "Platformer. Three worlds, coins, and bots.", publisher: "amoran.io" },
        { name: "JSON", description: "Colour for about.json and work.json.", publisher: "amoran.io" },
        { name: "Agent Skills", description: "skills.md, written for an agent to read.", publisher: "amoran.io" },
        { name: "Shortcuts", description: "Profile and project links as .lnk fields.", publisher: "amoran.io" }
    ]
};
