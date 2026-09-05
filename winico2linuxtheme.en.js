#!/usr/bin/env gjs

imports.gi.versions.Gtk = '3.0';
imports.gi.versions.GLib = '2.0';
const Gtk = imports.gi.Gtk;
const GdkPixbuf = imports.gi.GdkPixbuf;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;

Gtk.init(null);

// ==================== HELP ARGUMENT HANDLING ====================

let scriptName = GLib.path_get_basename(imports.system.programInvocationName);

if (ARGV.includes('-h') || ARGV.includes('--help')) {
    print("Usage: " + GLib.path_get_basename(ARGV[0]) + " [OPTIONS] [ICO_FILE]\n");
    print("View icons from ICO files and install into Linux theme.");
    print("");
    print("Options:");
    print("  -t FILE       Path to theme index.theme file");
    print("  -c CONTEXT    Context to select (actions, devices, mimetypes, places, etc.)");
    print("  -n NAME       Icon name without extension");
    print("  -h, --help    Show this help and exit");
    print("");
    print("Arguments:");
    print("  ICO_FILE      Path to .ico file to open");
    print("");
    print("Examples:");
    print("  " + scriptName + " icon.ico");
    print("  " + scriptName + " -t /path/to/index.theme -c devices icon.ico");
    print("  " + scriptName + " -t theme/index.theme -c actions -n my-icon icon.ico");
    print("  " + scriptName + " -h");
    print("");
    print("INI file format (created alongside ICO):");
    print("  [defaults]");
    print("  name=icon");
    print("  context=devices");
    print("  themefile=/path/to/index.theme");
    print("");
    print("  [bit-depth]");
    print("  16x16=8");
    print("  32x32=32");
    print("  48x48=8");
    print("");
    print("Available color depths:");
    print("  1  - Mono");
    print("  4  - 16 colors");
    print("  8  - 256 colors");
    print("  16 - HiColor");
    print("  24 - TrueColor");
    print("  32 - XP");

    // Exit with code 0 (success)
    imports.system.exit(0);
}

// ==================== COMMAND LINE ARGUMENT HANDLING ====================

let cmdlineThemeFile = null;
let cmdlineContext = null;
let cmdlineIconName = null;
let cmdlineIcoFile = null;

let args = ARGV.slice();
for (let i = 0; i < args.length; i++) {
    if (args[i] === '-t' && i + 1 < args.length) {
        cmdlineThemeFile = args[i + 1];
        i++;
    } else if (args[i] === '-c' && i + 1 < args.length) {
        cmdlineContext = args[i + 1];
        i++;
    } else if (args[i] === '-n' && i + 1 < args.length) {
        cmdlineIconName = args[i + 1];
        i++;
    } else if (!args[i].startsWith('-')) {
        cmdlineIcoFile = args[i];
    }
}

// ==================== HELPER FUNCTIONS ====================

function getTempDir() {
    let tmpDir = GLib.getenv('TMPDIR');
    if (!tmpDir || tmpDir === '') {
        tmpDir = '/tmp';
    }
    return tmpDir;
}

function getBitDepthLabel(bitDepth) {
    let depth = parseInt(bitDepth);
    switch(depth) {
        case 1: return "Mono";
        case 4: return "16 colors";
        case 8: return "256 colors";
        case 16: return "HiColor";
        case 24: return "TrueColor";
        case 32: return "XP";
        default: return bitDepth + "bit";
    }
}

function getDefaultBitDepth(bitDepths) {
    // Default is 8 bit, or the largest available
    if (bitDepths.includes(8)) {
        return 8;
    }
    return bitDepths[bitDepths.length - 1]; // largest
}

function getImageDimensions(filePath) {
    try {
        let pixbuf = GdkPixbuf.Pixbuf.new_from_file(filePath);
        return { width: pixbuf.get_width(), height: pixbuf.get_height() };
    } catch (e) {
        return null;
    }
}

function getImageInfo(tempPngPath) {
    if (!tempPngPath) return null;
    
    let dimensions = getImageDimensions(tempPngPath);
    if (!dimensions) return null;
    
    // Get file modification time
    let file = Gio.File.new_for_path(tempPngPath);
    try {
        let info = file.query_info("time::modified", Gio.FileQueryInfoFlags.NONE, null);
        let mtime = info.get_modification_date_time();
        return {
            width: dimensions.width,
            height: dimensions.height,
            mtime: mtime
        };
    } catch (e) {
        return {
            width: dimensions.width,
            height: dimensions.height,
            mtime: null
        };
    }
}

function compareImages(leftPngPath, rightPngPath) {
    // leftPngPath - temporary PNG from ICO
    // rightPngPath - PNG from theme
    
    if (!leftPngPath) {
        return { status: "XXX", label: "XXX" };
    }
    
    let leftInfo = getImageInfo(leftPngPath);
    if (!leftInfo) {
        return { status: "XXX", label: "XXX" };
    }
    
    // Check if right file exists
    let rightFile = Gio.File.new_for_path(rightPngPath);
    if (!rightFile.query_exists(null)) {
        return { status: "==>", label: "==>" };
    }
    
    let rightInfo = getImageInfo(rightPngPath);
    if (!rightInfo) {
        return { status: "XXX", label: "XXX" };
    }
    
    // Compare dimensions
    let sizeMatch = (leftInfo.width === rightInfo.width && leftInfo.height === rightInfo.height);
    
    // Build size comparison string
    let sizeLabel = "";
    if (!sizeMatch) {
        let xChar = leftInfo.width > rightInfo.width ? 'X' : 'x';
        let yChar = leftInfo.height > rightInfo.height ? 'Y' : 'y';
        let rxChar = leftInfo.width < rightInfo.width ? 'X' : 'x';
        let ryChar = leftInfo.height < rightInfo.height ? 'Y' : 'y';
        sizeLabel = xChar + yChar + ':' + rxChar + ryChar;
    }
    
    // Compare timestamps
    if (leftInfo.mtime && rightInfo.mtime) {
        if (leftInfo.mtime.compare(rightInfo.mtime) > 0) {
            // Left is newer
            return { 
                status: "==>", 
                label: sizeMatch ? "==>" : sizeLabel 
            };
        } else if (leftInfo.mtime.compare(rightInfo.mtime) < 0) {
            // Left is older
            return { 
                status: "<==", 
                label: sizeMatch ? "<==" : sizeLabel 
            };
        } else {
            // Same age
            return { 
                status: "<=>", 
                label: sizeMatch ? "<=>" : sizeLabel 
            };
        }
    }
    
    // If timestamps couldn't be compared
    if (sizeMatch) {
        // Compare content
        try {
            let [success, stdout] = GLib.spawn_command_line_sync(
                'cmp -s ' + GLib.shell_quote(leftPngPath) + ' ' + GLib.shell_quote(rightPngPath)
            );
            // cmp returns 0 if files are identical, 1 if different
            if (success) {
                return { status: "===", label: "===" };
            } else {
                return { status: "<=>", label: "<=>" };
            }
        } catch (e) {
            return { status: "???", label: "???" };
        }
    } else {
        return { status: "<=>", label: sizeLabel };
    }
}

function parseIniFile(iniFilePath) {
    let iniData = {
        name: '',
        themefile: '',
        context: '',
        bitDepths: {}
    };
    
    try {
        let file = Gio.File.new_for_path(iniFilePath);
        if (!file.query_exists(null)) {
            return iniData;
        }
        
        let [success, contents] = file.load_contents(null);
        if (!success) {
            return iniData;
        }
        
        let text = imports.byteArray.toString(contents);
        let lines = text.split('\n');
        let currentSection = '';
        
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            
            if (line === '' || line.startsWith('#') || line.startsWith(';')) {
                continue;
            }
            
            let sectionMatch = line.match(/^\[(.+)\]$/);
            if (sectionMatch) {
                currentSection = sectionMatch[1].toLowerCase();
                continue;
            }
            
            let keyValue = line.split('=');
            if (keyValue.length >= 2) {
                let key = keyValue[0].trim().toLowerCase();
                let value = keyValue.slice(1).join('=').trim();
                
                if (currentSection === 'defaults') {
                    if (key === 'name') iniData.name = value;
                    else if (key === 'themefile') iniData.themefile = value;
                    else if (key === 'context') iniData.context = value;
                } else if (currentSection === 'bit-depth') {
                    iniData.bitDepths[key] = parseInt(value) || 0;
                }
            }
        }
    } catch (e) {
        log("Error parsing INI: " + e.message);
    }
    
    return iniData;
}

function parseIndexTheme(filePath) {
    let dirArray = {};
    
    try {
        let file = Gio.File.new_for_path(filePath);
        let [success, contents] = file.load_contents(null);
        
        if (!success) {
            log("Failed to read file: " + filePath);
            return dirArray;
        }
        
        let text = imports.byteArray.toString(contents);
        let lines = text.split('\n');
        
        let currentSection = '';
        
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            
            if (line === '' || line.startsWith('#')) {
                continue;
            }
            
            let sectionMatch = line.match(/^\[(.+)\]$/);
            if (sectionMatch) {
                currentSection = sectionMatch[1];
                continue;
            }
            
            let keyValue = line.split('=');
            if (keyValue.length === 2) {
                let key = keyValue[0].trim();
                let value = keyValue[1].trim();
                
                if (currentSection.match(/^[^\/]+\/\d+x\d+$/) || 
                    currentSection.match(/^[^\/]+\/\d+$/)) {
                    
                    if (key === 'Type' && value === 'Fixed') {
                        let parts = currentSection.split('/');
                        let context = parts[0];
                        let size = parts[1];
                        
                        if (!dirArray[context]) {
                            dirArray[context] = [];
                        }
                        
                        let sizeNum = parseInt(size);
                        if (!isNaN(sizeNum) && !dirArray[context].includes(sizeNum)) {
                            dirArray[context].push(sizeNum);
                            dirArray[context].sort((a, b) => a - b);
                        }
                    }
                }
            }
        }
    } catch (e) {
        log("Error parsing index.theme: " + e.message);
    }
    
    return dirArray;
}

function getThemeBasePath(indexThemePath) {
    let file = Gio.File.new_for_path(indexThemePath);
    let parent = file.get_parent();
    return parent.get_path();
}

function parseIcoFile(icoFilePath) {
    let formats = {};
    
    try {
        let [success, stdout, stderr, exitStatus] = GLib.spawn_command_line_sync(
            'icotool -l ' + GLib.shell_quote(icoFilePath)
        );
        
        if (!success || exitStatus !== 0) {
            log("Error executing icotool: " + imports.byteArray.toString(stderr));
            return formats;
        }
        
        let output = imports.byteArray.toString(stdout);
        let lines = output.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            if (line === '') continue;
            
            let widthMatch = line.match(/--width=(\d+)/);
            let heightMatch = line.match(/--height=(\d+)/);
            let bitDepthMatch = line.match(/--bit-depth=(\d+)/);
            
            if (widthMatch && heightMatch && bitDepthMatch) {
                let width = parseInt(widthMatch[1]);
                let height = parseInt(heightMatch[1]);
                let bitDepth = parseInt(bitDepthMatch[1]);
                let format = width + 'x' + height;
                
                if (!formats[format]) {
                    formats[format] = [];
                }
                
                if (!formats[format].includes(bitDepth)) {
                    formats[format].push(bitDepth);
                }
            }
        }
        
        for (let format in formats) {
            formats[format].sort((a, b) => a - b);
        }
        
    } catch (e) {
        log("Error parsing ICO: " + e.message);
    }
    
    return formats;
}

// ==================== GLOBAL VARIABLES ====================

let dirArray = {};
let currentContext = '';
let themeBasePath = '';
let icoFormats = {};
let icoFilePath = '';
let themeFilePath = '';
let pendingContext = null;
let iniData = null;
let bottomHboxes = [];

let window = new Gtk.Window({
    title: "Icon Installer",
    default_width: 1000,
    default_height: 700,
    border_width: 10
});

let mainVbox = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 10
});

let scrollWindow = new Gtk.ScrolledWindow({
    expand: true,
    vexpand: true
});

let scrollVbox = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 5
});

// ==================== TOP BLOCK ====================

let topHbox = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 10,
    valign: Gtk.Align.START
});

let openIcoButton = new Gtk.Button({
    valign: Gtk.Align.CENTER,
    tooltip_text: "Open ICO file"
});
let icoIcon = new Gtk.Image({
    icon_name: "image-x-generic",
    icon_size: Gtk.IconSize.BUTTON
});
openIcoButton.set_image(icoIcon);

let openThemeButton = new Gtk.Button({
    valign: Gtk.Align.CENTER,
    tooltip_text: "Open index.theme file"
});
let themeIcon = new Gtk.Image({
    icon_name: "document-open",
    icon_size: Gtk.IconSize.BUTTON
});
openThemeButton.set_image(themeIcon);

let saveIniButton = new Gtk.Button({
    valign: Gtk.Align.CENTER,
    tooltip_text: "Save settings to INI file"
});
let saveIcon = new Gtk.Image({
    icon_name: "document-save",
    icon_size: Gtk.IconSize.BUTTON
});
saveIniButton.set_image(saveIcon);

let searchEntry = new Gtk.Entry({
    placeholder_text: "Icon name (without extension)...",
    valign: Gtk.Align.CENTER
});

let contextComboBox = new Gtk.ComboBoxText({
    valign: Gtk.Align.CENTER
});

topHbox.pack_start(openIcoButton, false, false, 0);
topHbox.pack_start(openThemeButton, false, false, 0);
topHbox.pack_start(saveIniButton, false, false, 0);
topHbox.pack_start(searchEntry, true, true, 0);
topHbox.pack_start(contextComboBox, false, false, 0);

// ==================== CONTEXT SELECTION FUNCTIONS ====================

function selectContext(contextName) {
    if (!contextName || !dirArray[contextName]) {
        return false;
    }
    
    let model = contextComboBox.get_model();
    let found = false;
    model.foreach((model, path, iter) => {
        let value = model.get_value(iter, 0);
        if (value === contextName) {
            contextComboBox.set_active(parseInt(path));
            found = true;
            return true;
        }
        return false;
    });
    
    return found;
}

// ==================== BOTTOM BLOCK CREATION FUNCTIONS ====================

function createBottomHbox(format, bitDepths, defaultBitDepth) {
    let hbox = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 10,
        valign: Gtk.Align.CENTER,
        margin_top: 2,
        margin_bottom: 2
    });
    
    let leftImage = new Gtk.Image();
    leftImage.set_from_icon_name("image-missing", Gtk.IconSize.DIALOG);
    leftImage.set_size_request(128, 128);
    
    let formatLabel = new Gtk.Label({
        label: format,
        valign: Gtk.Align.CENTER,
        halign: Gtk.Align.START,
        width_chars: 10
    });
    
    // Combo box with human-readable labels
    let bitDepthComboBox = new Gtk.ComboBoxText({
        valign: Gtk.Align.CENTER
    });
    
    let defaultIndex = 0;
    bitDepths.forEach((depth, index) => {
        bitDepthComboBox.append_text(getBitDepthLabel(depth));
        if (depth === defaultBitDepth) {
            defaultIndex = index;
        }
    });
    bitDepthComboBox.set_active(defaultIndex);
    
    // Store numeric depth values
    bitDepthComboBox.bitDepths = bitDepths;
    
    let pathEntry = new Gtk.Entry({
        placeholder_text: "Directory path...",
        valign: Gtk.Align.CENTER,
        editable: false
    });
    
    // Dynamic comparison label
    let compareLabel = new Gtk.Label({
        label: "",
        valign: Gtk.Align.CENTER,
        halign: Gtk.Align.CENTER,
        width_chars: 6
    });
    
    // Copy button
    let copyButton = new Gtk.Button({
        valign: Gtk.Align.CENTER,
        tooltip_text: "Copy to theme"
    });
    let arrowIcon = new Gtk.Image({
        icon_name: "go-next",
        icon_size: Gtk.IconSize.BUTTON
    });
    copyButton.set_image(arrowIcon);
    
    let rightImage = new Gtk.Image();
    rightImage.set_from_icon_name("image-missing", Gtk.IconSize.DIALOG);
    rightImage.set_size_request(128, 128);
    
    let blockData = {
        hbox: hbox,
        format: format,
        leftImage: leftImage,
        bitDepthComboBox: bitDepthComboBox,
        pathEntry: pathEntry,
        compareLabel: compareLabel,
        copyButton: copyButton,
        rightImage: rightImage,
        lastTempFile: null,
        hasThemeDir: false
    };
    
    bitDepthComboBox.connect("changed", () => {
        updateIcoImage(blockData);
        updateComparison(blockData);
    });
    
    copyButton.connect("clicked", () => {
        copyImageToTheme(blockData);
    });
    
    hbox.pack_start(leftImage, false, false, 0);
    hbox.pack_start(formatLabel, false, false, 0);
    hbox.pack_start(bitDepthComboBox, false, false, 0);
    hbox.pack_start(pathEntry, true, true, 0);
    hbox.pack_start(compareLabel, false, false, 0);
    hbox.pack_start(copyButton, false, false, 0);
    hbox.pack_start(rightImage, false, false, 0);
    
    return blockData;
}

function clearAllBottomBlocks() {
    bottomHboxes.forEach(block => {
        // Remove temporary files
        if (block.lastTempFile) {
            GLib.unlink(block.lastTempFile);
        }
        scrollVbox.remove(block.hbox);
    });
    bottomHboxes = [];
}

function updateBlockImages(blockData) {
    updateIcoImage(blockData);
    updateThemeImage(blockData);
    updateComparison(blockData);
}

function getCurrentBitDepth(blockData) {
    let activeIndex = blockData.bitDepthComboBox.get_active();
    return blockData.bitDepthComboBox.bitDepths[activeIndex];
}

function updateIcoImage(blockData) {
    if (!icoFilePath) {
        blockData.leftImage.set_from_icon_name("image-missing", Gtk.IconSize.DIALOG);
        blockData.lastTempFile = null;
        return;
    }
    
    let format = blockData.format;
    let [width, height] = format.split('x');
    let bitDepth = getCurrentBitDepth(blockData);
    let tempDir = getTempDir();
    let tempFile = GLib.build_filenamev([tempDir, 'ico_extracted_' + GLib.get_real_time() + '_' + format + '_' + bitDepth + '.png']);
    
    try {
        let [success, stdout, stderr, exitStatus] = GLib.spawn_command_line_sync(
            'icotool -x -w ' + width + ' -h ' + height + 
            ' -b ' + bitDepth + ' -o ' + GLib.shell_quote(tempFile) + 
            ' ' + GLib.shell_quote(icoFilePath)
        );
        
        if (success && exitStatus === 0) {
            let pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_size(tempFile, 128, 128);
            blockData.leftImage.set_from_pixbuf(pixbuf);
            
            // Delete previous temporary file
            if (blockData.lastTempFile) {
                GLib.unlink(blockData.lastTempFile);
            }
            blockData.lastTempFile = tempFile;
        } else {
            blockData.leftImage.set_from_icon_name("image-missing", Gtk.IconSize.DIALOG);
            if (blockData.lastTempFile) {
                GLib.unlink(blockData.lastTempFile);
                blockData.lastTempFile = null;
            }
            if (stderr.length > 0) {
                log("icotool error: " + imports.byteArray.toString(stderr));
            }
        }
    } catch (e) {
        blockData.leftImage.set_from_icon_name("image-missing", Gtk.IconSize.DIALOG);
        if (blockData.lastTempFile) {
            GLib.unlink(blockData.lastTempFile);
            blockData.lastTempFile = null;
        }
        log("Error extracting ICO: " + e.message);
    }
}

function updateThemeImage(blockData) {
    let iconName = searchEntry.get_text().trim();
    let dirPath = blockData.pathEntry.get_text();
    
    if (!iconName || !dirPath || !blockData.hasThemeDir) {
        blockData.rightImage.set_from_icon_name("image-missing", Gtk.IconSize.DIALOG);
        return;
    }
    
    let fileName = iconName + '.png';
    let filePath = GLib.build_filenamev([dirPath, fileName]);
    
    try {
        let pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_size(filePath, 128, 128);
        blockData.rightImage.set_from_pixbuf(pixbuf);
    } catch (e) {
        blockData.rightImage.set_from_icon_name("image-missing", Gtk.IconSize.DIALOG);
    }
}

function updateComparison(blockData) {
    if (!blockData.lastTempFile || !blockData.hasThemeDir) {
        blockData.compareLabel.set_text("");
        blockData.copyButton.set_sensitive(false);
        return;
    }
    
    let iconName = searchEntry.get_text().trim();
    let dirPath = blockData.pathEntry.get_text();
    
    if (!iconName || !dirPath) {
        blockData.compareLabel.set_text("");
        blockData.copyButton.set_sensitive(false);
        return;
    }
    
    let rightFilePath = GLib.build_filenamev([dirPath, iconName + '.png']);
    let result = compareImages(blockData.lastTempFile, rightFilePath);
    
    blockData.compareLabel.set_text(result.label);
    
    // Enable button only if there's something to copy (left file exists)
    blockData.copyButton.set_sensitive(blockData.lastTempFile !== null);
}

function copyImageToTheme(blockData) {
    if (!blockData.lastTempFile) {
        log("No extracted image to copy");
        return;
    }
    
    let iconName = searchEntry.get_text().trim();
    let dirPath = blockData.pathEntry.get_text();
    
    if (!iconName || !dirPath) {
        log("Destination path not specified");
        return;
    }
    
    let destFilePath = GLib.build_filenamev([dirPath, iconName + '.png']);
    
    try {
        let srcFile = Gio.File.new_for_path(blockData.lastTempFile);
        let destFile = Gio.File.new_for_path(destFilePath);
        
        // Create directory if it doesn't exist
        let destDir = destFile.get_parent();
        if (!destDir.query_exists(null)) {
            destDir.make_directory_with_parents(null);
        }
        
        srcFile.copy(destFile, Gio.FileCopyFlags.OVERWRITE, null, null);
        print("Copied: " + blockData.lastTempFile + " -> " + destFilePath);
        
        // Update images after copying
        updateThemeImage(blockData);
        updateComparison(blockData);
    } catch (e) {
        log("Copy error: " + e.message);
    }
}

function updateAllPathEntries() {
    if (!currentContext || !dirArray[currentContext]) {
        bottomHboxes.forEach(block => {
            block.pathEntry.set_text('');
            block.hasThemeDir = false;
            block.rightImage.set_from_icon_name("image-missing", Gtk.IconSize.DIALOG);
            block.compareLabel.set_text("");
            block.copyButton.set_sensitive(false);
        });
        return;
    }
    
    let availableSizes = dirArray[currentContext];
    
    bottomHboxes.forEach(block => {
        let format = block.format;
        let [width, height] = format.split('x');
        let targetSize = parseInt(width);
        
        // Look for exact size match
        if (availableSizes.includes(targetSize)) {
            let dirName = currentContext + '/' + targetSize;
            let fullPath = GLib.build_filenamev([themeBasePath, dirName]);
            block.pathEntry.set_text(fullPath);
            block.hasThemeDir = true;
        } else {
            // No suitable directory
            block.pathEntry.set_text("No directory for " + format);
            block.hasThemeDir = false;
            block.rightImage.set_from_icon_name("image-missing", Gtk.IconSize.DIALOG);
            block.compareLabel.set_text("");
            block.copyButton.set_sensitive(false);
            return;
        }
        
        updateBlockImages(block);
    });
}

// ==================== INI SAVE FUNCTION ====================

function saveIniFile() {
    if (!icoFilePath) {
        log("Please open an ICO file first");
        return;
    }
    
    let iconName = searchEntry.get_text().trim();
    if (!iconName) {
        log("Please enter an icon name");
        return;
    }
    
    let icoDir = GLib.path_get_dirname(icoFilePath);
    let icoBasename = GLib.path_get_basename(icoFilePath);
    let icoNameWithoutExt = icoBasename.replace(/\.[^.]+$/, '');
    let iniFilePath = GLib.build_filenamev([icoDir, icoNameWithoutExt + '.ini']);
    
    let iniContent = '[defaults]\n';
    iniContent += 'name=' + iconName + '\n';
    iniContent += 'context=' + currentContext + '\n';
    
    if (themeFilePath) {
        iniContent += 'themefile=' + themeFilePath + '\n';
    } else {
        iniContent += 'themefile=\n';
    }
    
    iniContent += '\n[bit-depth]\n';
    
    let sortedFormats = Object.keys(icoFormats).sort((a, b) => {
        let [aw, ah] = a.split('x').map(Number);
        let [bw, bh] = b.split('x').map(Number);
        return aw - bw || ah - bh;
    });
    
    sortedFormats.forEach(format => {
        let block = bottomHboxes.find(b => b.format === format);
        if (block) {
            let selectedBitDepth = getCurrentBitDepth(block);
            iniContent += format + '=' + selectedBitDepth + '\n';
        }
    });
    
    try {
        let file = Gio.File.new_for_path(iniFilePath);
        let [success] = file.replace_contents(
            iniContent,
            null,
            false,
            Gio.FileCreateFlags.REPLACE_DESTINATION,
            null
        );
        
        if (success) {
            print("INI file saved: " + iniFilePath);
        } else {
            log("Error saving INI file");
        }
    } catch (e) {
        log("Write error: " + e.message);
    }
}

// ==================== ICO LOAD WITH INI FUNCTION ====================

function loadIcoWithIni(filePath) {
    icoFilePath = filePath;
    print("Opened ICO: " + icoFilePath);
    
    icoFormats = parseIcoFile(icoFilePath);
    print("Found formats and color depths:");
    for (let format in icoFormats) {
        print("  " + format + ": " + icoFormats[format].map(d => getBitDepthLabel(d)).join(", "));
    }
    
    let icoDir = GLib.path_get_dirname(icoFilePath);
    let icoBasename = GLib.path_get_basename(icoFilePath);
    let icoNameWithoutExt = icoBasename.replace(/\.[^.]+$/, '');
    let iniFilePath = GLib.build_filenamev([icoDir, icoNameWithoutExt + '.ini']);
    
    iniData = parseIniFile(iniFilePath);
    let defaultBitDepths = {};
    
    if (iniData.name) {
        print("Loaded INI file: " + iniFilePath);
        
        if (cmdlineIconName) {
            searchEntry.set_text(cmdlineIconName);
        } else {
            searchEntry.set_text(iniData.name);
        }
        
        let contextToSet = cmdlineContext || iniData.context;
        
        if (contextToSet) {
            if (Object.keys(dirArray).length > 0) {
                if (selectContext(contextToSet)) {
                    print("Context set: " + contextToSet);
                } else {
                    log("Context '" + contextToSet + "' not found in theme");
                }
            } else {
                pendingContext = contextToSet;
                print("Context '" + contextToSet + "' will be set after theme loads");
            }
        }
        
        if (iniData.themefile) {
            let themeFile = Gio.File.new_for_path(iniData.themefile);
            if (themeFile.query_exists(null)) {
                loadThemeFile(iniData.themefile);
            }
        }
        
        defaultBitDepths = iniData.bitDepths;
    } else {
        if (cmdlineIconName) {
            searchEntry.set_text(cmdlineIconName);
        } else {
            searchEntry.set_text(icoNameWithoutExt);
        }
    }
    
    clearAllBottomBlocks();
    
    let sortedFormats = Object.keys(icoFormats).sort((a, b) => {
        let [aw, ah] = a.split('x').map(Number);
        let [bw, bh] = b.split('x').map(Number);
        return aw - bw || ah - bh;
    });
    
    sortedFormats.forEach(format => {
        let defaultDepth = defaultBitDepths[format] || getDefaultBitDepth(icoFormats[format]);
        let blockData = createBottomHbox(format, icoFormats[format], defaultDepth);
        bottomHboxes.push(blockData);
        scrollVbox.pack_start(blockData.hbox, false, false, 0);
    });
    
    if (currentContext) {
        updateAllPathEntries();
    }
    
    scrollVbox.show_all();
}

function loadThemeFile(filePath) {
    themeFilePath = filePath;
    print("Loaded theme: " + themeFilePath);
    
    themeBasePath = getThemeBasePath(themeFilePath);
    dirArray = parseIndexTheme(themeFilePath);
    
    print("Found contexts:");
    for (let context in dirArray) {
        print("  " + context + ": " + dirArray[context].join(", "));
    }
    
    updateContextComboBox();
}

// ==================== EVENT HANDLERS ====================

openIcoButton.connect("clicked", () => {
    let dialog = new Gtk.FileChooserDialog({
        title: "Select ICO file",
        action: Gtk.FileChooserAction.OPEN,
        transient_for: window,
        modal: true
    });
    
    dialog.add_button("Cancel", Gtk.ResponseType.CANCEL);
    dialog.add_button("Open", Gtk.ResponseType.OK);
    
    let filter = new Gtk.FileFilter();
    filter.set_name("ICO files");
    filter.add_pattern("*.ico");
    dialog.add_filter(filter);
    
    dialog.connect("response", (dialog, responseId) => {
        if (responseId === Gtk.ResponseType.OK) {
            loadIcoWithIni(dialog.get_filename());
        }
        dialog.destroy();
    });
    
    dialog.show();
});

openThemeButton.connect("clicked", () => {
    let dialog = new Gtk.FileChooserDialog({
        title: "Select index.theme file",
        action: Gtk.FileChooserAction.OPEN,
        transient_for: window,
        modal: true
    });
    
    dialog.add_button("Cancel", Gtk.ResponseType.CANCEL);
    dialog.add_button("Open", Gtk.ResponseType.OK);
    
    let filter = new Gtk.FileFilter();
    filter.set_name("index.theme files");
    filter.add_pattern("index.theme");
    dialog.add_filter(filter);
    
    dialog.connect("response", (dialog, responseId) => {
        if (responseId === Gtk.ResponseType.OK) {
            loadThemeFile(dialog.get_filename());
        }
        dialog.destroy();
    });
    
    dialog.show();
});

saveIniButton.connect("clicked", () => {
    saveIniFile();
});

function updateContextComboBox() {
    let previousContext = currentContext;
    
    contextComboBox.remove_all();
    
    let contexts = Object.keys(dirArray).sort();
    
    if (contexts.length === 0) {
        contextComboBox.append_text("No contexts");
        contextComboBox.set_active(0);
        currentContext = '';
        return;
    }
    
    contexts.forEach(context => {
        contextComboBox.append_text(context);
    });
    
    let targetContext = pendingContext || previousContext || contexts[0];
    
    if (targetContext && contexts.includes(targetContext)) {
        let index = contexts.indexOf(targetContext);
        contextComboBox.set_active(index);
        currentContext = targetContext;
        if (pendingContext && targetContext === pendingContext) {
            print("Set pending context: " + pendingContext);
            pendingContext = null;
        }
    } else {
        contextComboBox.set_active(0);
        currentContext = contexts[0];
    }
    
    updateAllPathEntries();
}

contextComboBox.connect("changed", () => {
    let selected = contextComboBox.get_active_text();
    if (selected && selected !== "No contexts") {
        currentContext = selected;
        updateAllPathEntries();
    }
});

let searchTimeout = 0;
searchEntry.connect("changed", () => {
    if (searchTimeout) {
        GLib.source_remove(searchTimeout);
    }
    searchTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {
        bottomHboxes.forEach(block => {
            updateBlockImages(block);
        });
        searchTimeout = 0;
        return false;
    });
});

// ==================== LAYOUT COMPOSITION ====================

scrollWindow.add(scrollVbox);
mainVbox.pack_start(topHbox, false, false, 0);
mainVbox.pack_start(scrollWindow, true, true, 0);

window.add(mainVbox);

window.connect("destroy", () => {
    // Clean up temporary files on exit
    bottomHboxes.forEach(block => {
        if (block.lastTempFile) {
            GLib.unlink(block.lastTempFile);
        }
    });
    Gtk.main_quit();
});

window.show_all();

// ==================== AUTO-LOAD FROM ARGUMENTS ====================

if (cmdlineThemeFile) {
    print("Loading theme from arguments: " + cmdlineThemeFile);
    let file = Gio.File.new_for_path(cmdlineThemeFile);
    if (file.query_exists(null)) {
        loadThemeFile(cmdlineThemeFile);
    } else {
        log("Theme file not found: " + cmdlineThemeFile);
    }
}

if (cmdlineIcoFile) {
    print("Loading ICO from arguments: " + cmdlineIcoFile);
    let file = Gio.File.new_for_path(cmdlineIcoFile);
    if (file.query_exists(null)) {
        loadIcoWithIni(cmdlineIcoFile);
    } else {
        log("ICO file not found: " + cmdlineIcoFile);
    }
}

Gtk.main();