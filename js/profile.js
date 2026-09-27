/* Edit this file.
   The conversations on the left are drawn from the values below.
   about.json uses person. work.json uses work.
   skills.md uses skill, and the same person fields as about.json.
   links.lnk lists social, plus one shortcut for each project.
   Add a string, a project, or a profile, then refresh.
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
            { name: "amoran.io", url: "https://amoran.io", note: "This workspace. Block Runner is the open conversation." }
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
    ]
};
