#!/usr/bin/env node
const gi = require("./node-gtk/lib/");
const path = require("path");

const Gtk = gi.require("Gtk", "3.0");
const WebKit2 = gi.require("WebKit2");

gi.startLoop();
Gtk.init();

const window = new Gtk.Window({
    type : Gtk.WindowType.TOPLEVEL
});

window.title = "NeoChat";

const webView = new WebKit2.WebView();

const scrollWindow = new Gtk.ScrolledWindow({});

const hbox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL });
const vbox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL });

scrollWindow.add(webView);

vbox.packStart(hbox, false, true, 0);
vbox.packStart(scrollWindow, true,  true, 0);

window.setDefaultSize(1400, 800);
window.setResizable(true);
window.add(vbox);

const webSettings = webView.getSettings();
webSettings.enableDeveloperExtras = true;
webSettings.enableCaretBrowsing = true;
console.log("webSettings: ", webSettings);

window.on("show", () => {
    Gtk.main();
});

window.on("destroy", () => Gtk.mainQuit());
window.on("delete-event", () => false);

main();

function main() {
    webView.loadUri(url("192.168.10.39:24024"));
    window.showAll();
}

function url(href) {
    return /^([a-z]{2,}):/.test(href) ? href : ("http://" + href);
}