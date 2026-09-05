# WinICO2LinuxTheme

## Instaler of Windows ICO files into Linux icon themes.

Screenshot:<br>
![screenshot.png](screenshot.png)

```
Usage: gjs winico2linuxtheme.en.js [OPTIONS] [ICO_FILE]

View icons from ICO files and install into Linux theme.

Options:
  -t FILE       Path to theme index.theme file
  -c CONTEXT    Context to select (actions, devices, mimetypes, places, etc.)
  -n NAME       Icon name without extension
  -h, --help    Show this help and exit

Arguments:
  ICO_FILE      Path to .ico file to open

Examples:
  winico2linuxtheme.en.js icon.ico
  winico2linuxtheme.en.js -t /path/to/index.theme -c devices icon.ico
  winico2linuxtheme.en.js -t theme/index.theme -c actions -n my-icon icon.ico
  winico2linuxtheme.en.js -h

INI file format (created alongside ICO):
  [defaults]
  name=icon
  context=devices
  themefile=/path/to/index.theme

  [bit-depth]
  16x16=8
  32x32=32
  48x48=8

Available color depths:
  1  - Mono
  4  - 16 colors
  8  - 256 colors
  16 - HiColor
  24 - TrueColor
  32 - XP
```