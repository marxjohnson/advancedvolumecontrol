/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

/* exported init */

const GETTEXT_DOMAIN = 'my-indicator-extension';

const { GObject, GLib, St} = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const ByteArray = imports.byteArray;
const Slider = imports.ui.slider;

const _ = ExtensionUtils.gettext;

const Indicator = GObject.registerClass(
class Indicator extends PanelMenu.Button {

    /**
     * Call out to pactl using GLib and return the list of sinks.
     *
     * @returns {any}
     */
    getSinks() {
        let [, stdout] = GLib.spawn_command_line_sync("pactl --format=json list sinks");
        return JSON.parse(ByteArray.toString(stdout));
    }

    /**
     * Use pactl to set the volume for a sink
     *
     * @param {int} id The numeric ID of the sink
     * @param {int} volume The volume level between 0 and 100.
     */
    setVolume(id, volume) {
        id = parseInt(id);
        volume = parseInt(volume);
        const command = "pactl set-sink-volume " + id + " " + volume + "%";
        let [ok, , stderr] = GLib.spawn_command_line_sync(command);
        if (!ok) {
            log("[ERROR] Could not set volume:" + ByteArray.toString(stderr));
        }
    }

    /**
     * Get the list of sinks, and display them in an indicator menu.
     *
     * The menu will contain a separator for each device, with the sinks in that device listed underneath.
     * For each sink, the menu will contain a slider set to the current volume level.
     * When the value of the slider is changed, the volume of that sink will be set based on the new value.
     *
     * @private
     */
    _init() {
        super._init(0.0, _('Advanced volume control'));

        this.add_child(new St.Icon({
            icon_name: 'audio-speakers-symbolic',
            style_class: 'system-status-icon',
        }));
        // Add sound icon using St toolkit.

        this._sinks = [];
        let lastDevice = '';
        this.getSinks().forEach((sink) => {
            if (sink.properties["device.product.name"] !== lastDevice) {
                lastDevice = sink.properties["device.product.name"];
                const separator = new PopupMenu.PopupSeparatorMenuItem(lastDevice);
                this.menu.addMenuItem(separator);
            }
            const initialVolume = parseInt(sink.volume["front-left"]["value_percent"]);
            const slider = new Slider.Slider(initialVolume / 100);
            let label = sink.properties["device.profile.description"];
            const item = new PopupMenu.PopupMenuItem(label, { activate: false });
            item.add_child(slider);
            const handler = slider.connect('notify::value', (slider) => {
                const volume = Math.floor(slider.value * 100);
                this.setVolume(sink.index, volume);
            });
            this.menu.addMenuItem(item)
            this._sinks.push({
                id: sink.index,
                slider: slider,
                menuItem: item,
                handler: handler,
            });
        });
    }

    destroy() {
        this._sinks.forEach((sink) => {
            sink.slider.disconnect(sink.handler);
        });
        super.destroy();
    }
});

class Extension {
    constructor(uuid) {
        this._uuid = uuid;

        ExtensionUtils.initTranslations(GETTEXT_DOMAIN);
    }

    enable() {
        this._indicator = new Indicator();
        Main.panel.addToStatusArea(this._uuid, this._indicator);
    }

    disable() {
        this._indicator.destroy();
        this._indicator = null;
    }
}

function init(meta) {
    return new Extension(meta.uuid);
}
