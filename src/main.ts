import { Plugin } from "obsidian";
import { RandomReviewSettings, DEFAULT_SETTINGS } from "./constants";

export default class RandomReviewPlugin extends Plugin {
  settings!: RandomReviewSettings;

  async onload() {
    await this.loadSettings();
    console.log("Random Review plugin loaded");
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
