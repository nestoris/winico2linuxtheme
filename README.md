# WinICO2LinuxTheme

## Instaler of Windows ICO files into Linux icon themes.

### Dependencies:
GTK3, GJS, icoutils<br><br>
### Installation of dependencies:
Debian/Ubuntu:
```
sudo apt update
sudo apt install gjs icoutils libgtk-3-0
```
Fedora/RHEL:
```
sudo dnf install gjs icoutils gtk3
```
Arch Linux:
```
sudo pacman -S gjs icoutils gtk3
```
openSUSE:
```
sudo zypper install gjs icoutils gtk3
```


Screenshot:<br>
![screenshot.png](screenshot.png)

```
Usage: gjs winico2linuxtheme.en.js [OPTIONS] [ICO_FILE]

View icons from ICO files and install into Linux theme.

Options:
  -t FILE       Path to the index.theme theme file
  -c CONTEXT    Context for selection (actions, devices, mimetypes, places, etc.)
  -n NAME       Icon name without extension
  -s SIZE       Display size of icons in pixels (default: original)
  -b            Enable smoothing (bilinear interpolation) when scaling
  -h, --help    Show this help and exit

Arguments:
  ICO_FILE      Path to .ico file to open

Examples:
  winico2linuxtheme.en.js icon.ico
  winico2linuxtheme.en.js -t /path/to/index.theme -c devices icon.ico
  winico2linuxtheme.en.js -t theme/index.theme -c actions -n my-icon icon.ico
  winico2linuxtheme.en.js -s 64 icon.ico
  winico2linuxtheme.en.js -s 128 -b icon.ico
  winico2linuxtheme.en.js -h

INI file format (created next to ICO):
  [defaults]
  name=icon
  context=devices
  themefile=/path/to/index.theme
  scale=128        # display size (optional)
  blur=true        # smoothing when scaling (optional)

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