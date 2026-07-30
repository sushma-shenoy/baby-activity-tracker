// This file is required by karma.conf.js and loads recursively all the .spec and framework files

import 'zone.js/testing';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting
} from '@angular/platform-browser-dynamic/testing';
import { addIcons } from 'ionicons';
import {
  addOutline,
  barChartOutline,
  bulbOutline,
  chevronForwardOutline,
  closeOutline,
  createOutline,
  ellipsisHorizontalOutline,
  homeOutline,
  pauseOutline,
  playOutline,
  settingsOutline,
  stopOutline,
  timeOutline,
  trashOutline
} from 'ionicons/icons';

addIcons({
  addOutline,
  barChartOutline,
  bulbOutline,
  chevronForwardOutline,
  closeOutline,
  createOutline,
  ellipsisHorizontalOutline,
  homeOutline,
  pauseOutline,
  playOutline,
  settingsOutline,
  stopOutline,
  timeOutline,
  trashOutline
});

// First, initialize the Angular testing environment.
getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting(),
);
