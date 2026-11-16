# Corto brand assets

Corto is a home video and slideshow maker by miille. Start with **corto-logo-guidelines.pdf**
for clear space, sizes, colour and how the icon is built.

## Which logo to use

| Version  | Use it for                                                     |
|----------|----------------------------------------------------------------|
| App icon | The main identity: app stores, docks, launch screens, websites |
| Lockup   | Website headers, documents, anywhere the name should appear    |
| Mark     | Small and single-colour uses: menu bar, favicon, stamps        |
| Wordmark | When the icon or mark is already shown nearby                  |

Use the **dark** app icon by default. Use black logos on light backgrounds and
white logos on dark ones. In text, write the name as **Corto**, or
**Corto by miille** where the parent brand should show.

## Folders

```
logo/
  svg/   Master vector files.
  pdf/   Vector files for print, Illustrator, InDesign or Word (flat logos).
  eps/   For printers or sign makers who ask for EPS (flat logos).
  png/   Transparent images. Flat logos at 512, 1024 and 2048 px wide;
         app icons at 512 and 1024 px.
icons/
  macos/    AppIcon.appiconset for Xcode, Corto.icns, and menu-bar template images
  ios/      1024 px square icon (iOS rounds the corners itself)
  android/  Adaptive icon layers, XML and the Play Store icon
  windows/  corto.ico (16 to 256 px)
  web/      Favicons, touch icon, app icons and a web manifest
social/     Profile pictures, link preview, banner and a profile preview
```

Files are named `corto-<version>-<colour>`. App icon files ending in `-square`
are full-bleed squares for platforms that apply their own corner mask.

The app icon SVGs use soft shadows and glows (SVG blur effects). Browsers show
them correctly, but some design apps simplify them on import. If anything
looks off, use the PNGs.

## Colour

| Colour           | Values (top to bottom)          |
|------------------|---------------------------------|
| Black            | #000000                         |
| White            | #FFFFFF                         |
| Graphite tile    | #262628 → #0F0F10 → #040404     |
| Glyph on graphite| #FFFFFF → #CBCBCB               |
| Light tile       | #FFFFFF → #F2F2F3 → #DADADC     |
| Glyph on light   | #1A1A1A → #3E3E3E               |

## Clear space and minimum size

Keep at least **x** clear around the lockup and wordmark, where x is the
height of the lowercase letters. Around the mark alone, keep half its height
clear.

| Version  | Digital                              | Print      |
|----------|--------------------------------------|------------|
| Lockup   | 100 px wide                          | 25 mm wide |
| Wordmark | 48 px wide                           | 12 mm wide |
| Mark     | 14 px tall                           | 4 mm tall  |
| App icon | 32 px (use the flat mark below that) | 10 mm      |

## Platform notes

**Mac.** Drag `icons/macos/AppIcon.appiconset` into your Xcode asset catalogue.
For the menu bar, use `MenuBarIconTemplate.png` / `@2x.png` (or the PDF) as a
template image so macOS colours it for light and dark menus.

**iPhone and iPad.** Use `icons/ios/AppIcon-1024.png` as the single 1024 px
app icon.

**Android.** Copy the `mipmap-*` folders into `res/`. `ic_launcher.xml` sets up
the adaptive icon, including the monochrome layer for themed icons. Upload
`playstore-icon-512.png` to Google Play.

**Windows.** Use `icons/windows/corto.ico`. Its 16 and 24 px sizes use the flat
mark on the tile; larger sizes use the full icon.

**Web.** Put the files from `icons/web` in your site's root folder and add this
to the page's `<head>`:

```html
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
```

## Social

| File                    | Use                                              |
|-------------------------|--------------------------------------------------|
| profile-1080-dark.png   | Profile picture, the default                     |
| profile-1080-light.png  | Profile picture for dark-themed pages            |
| og-image-1200x630.png   | Link previews when the website is shared         |
| banner-1500x500.png     | Header image for X and similar sites             |
| profile-preview.png     | How the profile pictures look in a circle frame  |

The glyph sits inside the middle 53% of the profile picture, so no circle
crop can clip it.

## Please don't

Recolour the icon, add extra effects, stretch, rotate or redraw the logo, or
use the dimensional icon below 32 px. Always use these files as they are.
