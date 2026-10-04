# Storyboard v3

Use a storyboard as a production contract, not a list of arbitrary clicks. `walkthrough plan` validates the required fields and gives the recorder a stable input.

```json
{
  "title": "Create and share a saved view",
  "mode": "walkthrough",
  "baseUrl": "http://localhost:5173",
  "outputDir": "./walkthrough-output",
  "brand": { "accent": "#5B5BD6" },
  "steps": [
    { "id": "orient", "title": "Show the saved views page", "holdMs": 1800 },
    {
      "id": "create",
      "title": "Create a filtered saved view",
      "selector": "[data-testid='create-view']",
      "action": "click",
      "zoomOnClick": true,
      "waitFor": { "selector": "[role='dialog']", "state": "visible" },
      "holdMs": 2300
    },
    {
      "id": "name",
      "title": "Name the view",
      "selector": "[name='view-name']",
      "action": "type",
      "text": "Design review",
      "waitFor": { "selector": "[data-testid='save-view']:not([disabled])" }
    }
  ]
}
```

## Fields

| Field | Meaning |
| --- | --- |
| `mode` | `walkthrough`, `explainer`, or `pitch`; defaults to `walkthrough`. |
| `title`, `baseUrl`, `steps` | Required production identity, app address, and journey. |
| `id`, `title` | A stable step identifier and a human-readable intent. `desc` is accepted as a legacy alias for `title`. |
| `selector`, `action` | Optional for an orientation/result beat. Action is `click`, `type`, `press`, `hover`, or `select`. |
| `text` / `value` / `key` | Payload for typing, selection, or a key press. |
| `waitFor` | Outcome contract: `{selector, state, text, url, timeoutMs}`. Do not rely on a fixed sleep when the product supplies an observable result. |
| `zoomOnClick` | A deliberate focus cue, not a default. |
| `holdMs` | 400–20,000ms; default 2,400ms. Adjust to the amount of information a viewer must absorb. |

Use a real, visible outcome after significant actions. For a step that changes route, wait on `url`; for a save, wait on its confirmation; for an async panel, wait on a relevant selector or text. Do not select implementation-detail classes when a semantic selector can be added.
