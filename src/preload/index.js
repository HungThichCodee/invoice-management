'use strict';
const { contextBridge, ipcRenderer, webUtils } = require('electron');
const channels=['snapshot','createInvoice','updateInvoice','deleteInvoice','addPayment','createCustomer','updateCustomer','customerProfile','planBulkPayment','addBulkPayment','reports','dashboard','chooseImportFile','dryRunImport','commitImport','downloadImportErrors','undoImport','downloadTemplate','chooseLogo','saveSettings','chooseDataFolder','chooseExportFolder','openFolder','backup','restore','pdf','print','excel','csv'];
const api=Object.fromEntries(channels.map(name=>[name,(...args)=>ipcRenderer.invoke(name,...args)]));
api.pathForFile=file=>webUtils.getPathForFile(file);
contextBridge.exposeInMainWorld('hoaDon',Object.freeze(api));
