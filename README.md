# Google Flow Generative Dashboard

A desktop/local dashboard designed to make image generation through **Google Flow** more intuitive, organized, and practical — especially when working with multiple generations and variations.

## Purpose

Google Flow provides a powerful creative environment, but its workflow is primarily designed around the official web interface. This project aims to provide a dedicated dashboard around that workflow, with an emphasis on:

- Intuitive prompt-based image generation
- Batch generation and multiple variations
- Reference image management
- Generation history
- Project-based organization
- Prompt presets and reusable workflows
- Easy image preview and download
- A clean interface focused on creative work rather than unnecessary complexity

The long-term goal is to turn Google Flow into something closer to a personal **image generation workstation**.

## Free-first

The project is intended to be **completely free to use** and does not require users to purchase an API key.

The intended approach is to use the user's own Google Flow session and the access/credits provided by Google Flow itself. The dashboard is not intended to provide a separate paid generation backend.

> **Important:** "Free" does not mean unlimited. Google Flow may impose credits, quotas, availability restrictions, regional limitations, or subscription requirements. Those limits are controlled by Google and are outside this project's control.

## How it works

The planned architecture is a local application that provides the interface while Google Flow remains responsible for the actual generation.

```
┌───────────────────────────────────────┐
│       Google Flow Generative          │
│             Dashboard                 │
│                                       │
│  Prompt     References     Presets     │
│  Batch      History        Projects    │
└───────────────────┬───────────────────┘
                    │
                    ▼
             Local automation
                    │
                    ▼
             Google Flow
                    │
                    ▼
          User's Google account
                    │
                    ▼
        Google image generation
```

The project is intended to keep authentication local. Users should authenticate through Google's own interface rather than providing their Google password to this application.

## Planned features

### Generation

- [ ] Prompt editor
- [ ] Batch generation
- [ ] Multiple variations
- [ ] Aspect ratio controls
- [ ] Generation queue
- [ ] Generation progress/status
- [ ] Regenerate variation
- [ ] Prompt history

### References

- [ ] Upload reference images
- [ ] Multiple references per generation
- [ ] Reference library
- [ ] Reuse references across projects
- [ ] Drag-and-drop references

### Organization

- [ ] Projects
- [ ] Generation history
- [ ] Image gallery
- [ ] Favorites
- [ ] Prompt presets
- [ ] Search and filtering
- [ ] Local metadata

### Desktop experience

- [ ] Persistent Google Flow session
- [ ] Local-first storage
- [ ] No mandatory external backend
- [ ] Native file management
- [ ] Keyboard shortcuts
- [ ] Dark interface
- [ ] Responsive workspace

## Privacy

The project is designed around a local-first model.

The application should not require users to send their prompts, reference images, or Google credentials to a third-party server.

Authentication should be performed through Google Flow itself, with the application reusing the authenticated browser session where technically appropriate.

## Important limitations

This project is an independent community project and is **not affiliated with, endorsed by, or sponsored by Google**.

Google Flow is a third-party service. Its interface, authentication mechanisms, usage limits, availability, and behavior can change at any time.

If the implementation uses browser automation rather than an official API, changes to the Flow interface may require corresponding updates to this project.

The project should not attempt to bypass Google's authentication, security controls, quotas, payment requirements, or other access restrictions.

## Project status

**Early development**

The repository currently serves as the foundation for the project. The initial objective is to build the dashboard interface and establish a reliable local integration with Google Flow before expanding into advanced batch workflows.

## Vision

The end result should feel less like a complicated automation tool and more like a dedicated creative application:

```
Prompt
   ↓
References
   ↓
Generation settings
   ↓
Batch
   ↓
Google Flow
   ↓
Gallery
   ↓
Select / compare / regenerate
```

The focus is simple:

**Write → Generate → Compare → Iterate.**

## Disclaimer

Google Flow, Gemini, Nano Banana, Veo, and related names are trademarks or products of Google. This project is an independent tool and does not claim ownership or affiliation with Google.

Use of Google Flow remains subject to Google's own terms, policies, availability, and usage limits.

## License

License to be defined as the project architecture and implementation stabilize.
