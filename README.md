# Hygraph Asset Focal Point Picker

A [Hygraph App Framework](https://hygraph.com/docs/app-framework) app that lets content editors pick an image focal point on **Asset** entries. Coordinates are stored as JSON (`{ x, y }` percentages) for use with CSS `object-position` on the frontend.

**Demo deployment:** https://hygraph-focal-point-picker.vercel.app

<img width="1432" height="621" alt="Focal Point demo image" src="https://github.com/user-attachments/assets/340f9cdf-32a4-48b4-ac0b-756a63a02b89" />

## Features

- **Field element** — focal point picker embedded in the Asset form
- **Sidebar element** (optional) — same picker in the content editor sidebar
- Localized assets supported (reads from your configured image field, default `file`)
- Lightweight Next.js app using `@hygraph/app-sdk-react`

## How it works

| Route | Hygraph element | Purpose |
|---|---|---|
| `/setup` | Setup URL | Install flow |
| `/focal-point-field` | Field (`focalPointField`) | Primary UI — saves via `useFieldExtension` + `onChange` |
| `/select-focal-point` | Sidebar (`selectFocalPoint`) | Optional mirror of the picker |

Values are saved when editors pick a point in the **Focal point** field on the asset form and save the entry.

## Quick start

### 1. Deploy

Fork this repo and deploy to [Vercel](https://vercel.com) (or any host that serves the Next.js app over HTTPS). Note your deployment URL — Hygraph requires HTTPS and the app only runs inside Hygraph Studio.

```bash
npm install
npm run build
```

### 2. Register the app in Hygraph

Go to **Your apps → Add new app** in [Hygraph Studio](https://hygraph.com/docs/app-framework/register-an-app).

**General**

| Field | Value |
|---|---|
| Name | `An Asset Focal Point Picker` (or your choice) |
| API ID | `an-asset-focal-point` (must be globally unique) |
| Setup URL | `https://<your-deployment>/setup` |
| Avatar URL | Any public image URL |

**Permissions** — none required (the app uses the SDK form API only).

**Elements**

*Field element (required)*

| Field | Value |
|---|---|
| Name | `Focal point` |
| API ID | `focalPointField` |
| Type | `field` |
| Field type | `JSON` |
| Features | `FieldRenderer` |
| URL | `https://<your-deployment>/focal-point-field` |

Field config:

```json
{
  "imageField": {
    "type": "string",
    "displayName": "Image field API ID",
    "defaultValue": "file"
  }
}
```

*Sidebar element (optional)*

| Field | Value |
|---|---|
| Name | `Select focal point` |
| API ID | `selectFocalPoint` |
| Type | `formSidebar` |
| URL | `https://<your-deployment>/select-focal-point` |

Save the app, then copy the **App Sharing** URL from the Sharing tab.

### 3. Install in your project

Open the sharing URL in your Hygraph project and complete the setup flow.

### 4. Add the field to the Asset model

1. Open **Asset** → **Add field** → **Apps** → **Focal point** (not a generic JSON field).
2. Set API ID to `focalPoint`. Enable **localization** if your image field is localized.
3. **Important:** In the field settings, set the form renderer to **Focal point**, not **Json Editor**. Hygraph may default to Json Editor; leaving it there shows *“App element not found for field Focal point”* in the asset form.
4. Optionally add the **Select focal point** sidebar widget.
5. Save and publish the schema.

## Stored value

```json
{ "x": 35, "y": 20 }
```

Query from the Content API.

When querying an **Asset** entry directly, `url` is a system field on the model — there is no `file` relation:

```graphql
query AssetFocalPoint($id: ID!, $locale: Locale!) {
  asset(where: { id: $id }, locales: [$locale]) {
    focalPoint
    url
    fileName
    width
    height
  }
}
```

When the image comes from an **Asset relation** on another model (e.g. `heroImage`), query through that field:

```graphql
query PostWithFocalPoint {
  post(where: { slug: "my-post" }) {
    heroImage {
      focalPoint
      url
      fileName
    }
  }
}
```

If `focalPoint` is localized, pass `locales: [en]` (or your locale) on the query, or use `localizations { locale focalPoint url }`.

Use on the frontend:

```css
img {
  object-fit: cover;
  object-position: 35% 20%;
}
```

## Local development

```bash
npm install
npm run dev
```

App pages only connect to Hygraph when opened inside Studio (during install or on an entry). Opening routes directly in the browser shows a connection message — that is expected.

## Troubleshooting

| Symptom | Fix |
|---|---|
| *App element not found for field Focal point* | Set form renderer to **Focal point** (not Json Editor) in schema field settings |
| Picker shows “upload image first” | Upload/select an image in the configured image field (`file` by default) for the active locale |
| Sidebar saves but JSON field stays empty | Use the **Focal point** app field in the main form; the sidebar is optional |

## License

MIT — see [LICENSE](LICENSE).
