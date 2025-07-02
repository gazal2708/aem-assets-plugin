:construction: This is an early access technology and is still heavily in development. Reach out to us over Slack / Discord before using it.

# AEM Edge Delivery Services Assets Plugin
The AEM Assets Plugin helps you quickly integrate with AEM Assets for your AEM project. It is currently available to customers in collaboration with AEM Engineering via co-innovation VIP Projects. To implement your use cases, please reach out to the AEM Engineering team in the Slack channel dedicated to your project.

## Features
- A collection of blocks to use AEM Assets in Edge Delivery Services based websites
- Utility functions to generate markup for delivering assets from AEM Assets

## Prerequisites
- You need to have an AEM Assets as a Cloud Service subscription
- You need to have access to [Dynamic Media Open API](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/assets/dynamicmedia/dynamic-media-open-apis/dynamic-media-open-apis-overview)

And you need to have pre-configured:
- [AEM Assets Sidekick plugin](https://www.aem.live/docs/aem-assets-sidekick-plugin) if using Doc based authoring OR
- [Universal Editor Custom Asset Picker](https://developer.adobe.com/uix/docs/extension-manager/extension-developed-by-adobe/configurable-asset-picker/) if using Universal Editor based authoring

## Retention of External Image URLs (New Feature)
When converting HTML documents to Markdown, images are typically processed and their URLs rewritten for internal delivery (e.g., via /media_...). For Adobe Experience Manager (AEM) assets delivered through Dynamic Media with open API (DMwOAPI) or Scene7, rewriting these URLs can prevent the use of advanced features provided by DMwOAPI.

This feature allows you to configure prefixes for external asset url's, so images with matching URLs are retained in the Markdown output, while all other images are processed as usual

## How to Enable Retention of External Image URLs Feature 
This feature is opt-in and must be enabled by Adobe for your organization/site.
To request this feature, reach out to Adobe and provide the following information:

`site-name`, `org-name`, `List of Image Delivery URL prefixes to retain`

Example: 

site-name : hac-poc ,
org-name : adobeorg, 
List of Image Delivery URL prefixes to retain : ['https://delivery-p66302-e574366.adobeaemcloud.com/, 'https://s7ap1.scene7.com/is/image/varuncloudready/']

Adobe will enable this feature for your specified site and organization. Once enabled, images matching the provided prefix will be retained as external URLs as described above. 


## Installation

Add the plugin to your AEM project by running:
```sh
git subtree add --squash --prefix plugins/aem-assets-plugin git@github.com:adobe-rnd/aem-assets-plugin.git main
```

If you later want to pull the latest changes and update your local copy of the plugin
```sh
git subtree pull --squash --prefix plugins/aem-assets-plugin git@github.com:adobe-rnd/aem-assets-plugin.git main
```

If you prefer using `https` links you'd replace `git@github.com:adobe-rnd/aem-assets-plugin.git` in the above commands by `https://github.com:adobe-rnd/aem-assets-plugin.git`.

If the `subtree pull` command is failing with an error like:
```
fatal: can't squash-merge: 'plugins/aem-assets-plugin' was never added
```
you can just delete the folder and re-add the plugin via the `git subtree add` command above.

## Updating project configuration

To properly connect and configure the plugin for your project, you'll need to edit ⁣scripts.js in your AEM project and add a new file aem-assets-plugin-support.js inside  scripts folder.

Here's typically how `scripts/aem-assets-plugin-support.js` would look:

```
// The based path of the aem-assets-plugin code.
const codeBasePath = `${window.hlx?.codeBasePath}/plugins/aem-assets-plugin`;
 
// The blocks that are to be used from the aem-assets-plugin.
const blocks = ['video'];
 
// Initialize the aem-assets-plugin.
export default async function assetsInit() {
  const {
    loadBlock,
    createOptimizedPicture,
    decorateExternalImages,
    createOptimizedPictureForDMOpenAPI,
    createOptimizedPictureForDM,
  } = await import(`${codeBasePath}/scripts/aem-assets.js`);
  window.hlx = window.hlx || {};
  window.hlx.aemassets = {
    codeBasePath,
    blocks,
    loadBlock,
    createOptimizedPicture,
    decorateExternalImages,
    createOptimizedPictureForDMOpenAPI,
    createOptimizedPictureForDM,
    smartCrops: {
      Small: { minWidth: 0, maxWidth: 767 },
      Medium: { minWidth: 768, maxWidth: 1023 },
      Large: { minWidth: 1024, maxWidth: 9999 },
    },
    externalImageUrlPrefixes: [
      ['https://delivery-p66302-e574366.adobeaemcloud.com/', createOptimizedPictureForDMOpenAPI],
      ['https://s7ap1.scene7.com/is/image/varuncloudready/', createOptimizedPictureForDM],
    ],
  };
}
```

The externalImageUrlPrefixes is a list of URL prefix-handler tuple pairs. For any image URL that starts with a matching prefix, the corresponding handler function (e.g., createOptimizedPictureForDMOpenAPI or createOptimizedPictureForDM) will be used to process that image

You'd need to add the following code for handling external images inside decorateMain Function in `scripts.js` 

```
if (window.hlx.aemassets?.decorateExternalImages) {
    window.hlx.aemassets.decorateExternalImages(main);
}
```

Here is the updated version of `decorateMain` function

```
export function decorateMain(main) {
  if (window.hlx.aemassets?.decorateExternalImages) {
    window.hlx.aemassets.decorateExternalImages(main);
  }
   
  // hopefully forward compatible button decoration
  decorateButtons(main);
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateBlocks(main);
}
```

In `scripts/scripts.js` you'd need to add the following lines of code:

Import `aem-assets-plugin-support.js`
```
import assetsInit from './aem-assets-plugin-support.js';
```

Initialize `aem-assets-plugin-support.js`
```
await assetsInit(); // This to be done before loadPage() function invocation
loadPage();
```

## FAQ

Q. Why should I use this plugin?

A. The plugin provides a quick way to start using AEM Assets in your website. It abstracts and implements the groundwork to be able to consume AEM Assets delivery URLs in your wbsite, thus helps avoiding additional work to implement everything from scratch. This plugin also has a collection of standard blocks to consume AEM Assets which can be reused as they are, or copied over in your website for adaptations.