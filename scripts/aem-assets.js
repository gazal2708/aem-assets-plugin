/**
 * Gets the extension of a URL.
 * @param {string} url The URL
 * @returns {string} The extension
 * @private
 * @example
 * get_url_extension('https://example.com/foo.jpg');
 * // returns 'jpg'
 * get_url_extension('https://example.com/foo.jpg?bar=baz');
 * // returns 'jpg'
 * get_url_extension('https://example.com/foo');
 * // returns ''
 * get_url_extension('https://example.com/foo.jpg#qux');
 * // returns 'jpg'
 */
function getUrlExtension(url) {
  return url.split(/[#?]/)[0].split('.').pop().trim();
}

/**
 * Checks if an element is an external image.
 * @param {Element} element The element
 * @param {string} externalImageMarker The marker for external images
 * @returns {boolean} Whether the element is an external image
 * @private
 */
function isExternalImage(element, externalImageMarker) {
  // if the element is not an anchor, it's not an external image
  if (element.tagName !== 'A') return false;

  // if the element is an anchor with the external image marker as text content,
  // it's an external image
  if (element.textContent.trim() === externalImageMarker) {
    return true;
  }

  const ext = getUrlExtension(element.getAttribute('href'));
  return ext && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext.toLowerCase());
}

/*
  * Appends query params to a URL. Only allows query params as per Assets Delivery API - https://adobe-aem-assets-delivery.redoc.ly/
  * @param {string} url The URL to append query params to
  * @param {object} params The query params to append
  * @returns {string} The URL with query params appended
  * @private
  * @example
  * appendQueryParams('https://example.com', { foo: 'bar' });
  * // returns 'https://example.com?foo=bar'
*/
function appendQueryParams(url, params) {
  const { searchParams } = url;
  // only allow query params as per Assets Delivery API - https://adobe-aem-assets-delivery.redoc.ly/
  const allowedParams = ['rotate', 'crop', 'flip', 'size', 'preferwebp', 'height', 'width', 'quality', 'smartcrop'];
  params.forEach((value, key) => {
    if (allowedParams.includes(key)) {
      searchParams.set(key, value);
    }
  });
  url.search = searchParams.toString();
  return url.toString();
}

/**
 * Loads a CSS file.
 * @param {string} href URL to the CSS file
 */
async function loadCSS(href) {
  return new Promise((resolve, reject) => {
    if (!document.querySelector(`head > link[href="${href}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.onload = resolve;
      link.onerror = reject;
      document.head.append(link);
    } else {
      resolve();
    }
  });
}

/**
 * Creates an optimized picture element for an image.
 * If the image is not an absolute URL, it will be passed to libCreateOptimizedPicture.
 * @param {string} src The image source URL
 * @param {string} alt The image alt text
 * @param {boolean} eager Whether to load the image eagerly
 * @param {object[]} breakpoints The breakpoints to use
 * @param {string} imageFormat The image format to use
 * @returns {Element} The picture element
 *
 */
export function createOptimizedPicture({
  src,
  alt = '',
  eager = false,
  breakpoints = [
    { media: '(min-width: 600px)', width: '2000' },
    { width: '750' }
  ],
  imageFormat = 'webp'
}) {
  const url = new URL(src);
  const picture = document.createElement('picture');
  const { pathname } = url;
  const ext = pathname.substring(pathname.lastIndexOf('.') + 1);

  // webp
  breakpoints.forEach((br) => {
    const source = document.createElement('source');
    if (br.media) source.setAttribute('media', br.media);
    source.setAttribute('type', `image/${imageFormat}`);
    const searchParams = new URLSearchParams({ width: br.width, format: imageFormat });
    source.setAttribute('srcset', appendQueryParams(url, searchParams));
    picture.appendChild(source);
  });

  // fallback
  breakpoints.forEach((br, i) => {
    const searchParams = new URLSearchParams({ width: br.width, format: ext });

    if (i < breakpoints.length - 1) {
      const source = document.createElement('source');
      if (br.media) source.setAttribute('media', br.media);
      source.setAttribute('srcset', appendQueryParams(url, searchParams));
      picture.appendChild(source);
    } else {
      const img = document.createElement('img');
      img.setAttribute('loading', eager ? 'eager' : 'lazy');
      img.setAttribute('alt', alt);
      picture.appendChild(img);
      img.setAttribute('src', appendQueryParams(url, searchParams));
    }
  });

  return picture;
}

/**
 * Creates an optimized picture element for an image
 * leveraging smartcrop config from 'window.hlx.aemassets.smartCrops'.
 * @param {string} src The image source URL
 * @param {string} alt The image alt text
 * @param {boolean} eager Whether to load the image eagerly
 * @param {object[]} breakpoints The breakpoints to use
 * @returns {Element} The picture element
 */
export function createOptimizedPictureWithSmartcrop(src, alt = '', eager = false, breakpoints = []) {
  const isAbsoluteUrl = /^https?:\/\//i.test(src);

  // initialise breakpoint to project level smartcrop config unless needed to customise
  const smartcropBreakpoints = breakpoints.length !== 0 ? breakpoints
    : Object.entries(window.hlx.aemassets?.smartCrops).map(
      ([name, { minWidth, maxWidth }]) => ({
        media: `(min-width: ${minWidth}px) and (max-width: ${maxWidth}px)`,
        smartcrop: name,
      }),
    );

  const url = isAbsoluteUrl ? new URL(src) : new URL(src, window.location.href);
  const picture = document.createElement('picture');
  const { pathname } = url;
  const ext = pathname.substring(pathname.lastIndexOf('.') + 1);

  // webp
  smartcropBreakpoints.forEach((br) => {
    const source = document.createElement('source');
    if (br.media) source.setAttribute('media', br.media);
    source.setAttribute('type', 'image/webp');
    const searchParams = new URLSearchParams({ smartcrop: br.smartcrop, format: 'webply' });
    source.setAttribute('srcset', appendQueryParams(url, searchParams));
    picture.appendChild(source);
  });

  // fallback for non-webp
  smartcropBreakpoints.forEach((br) => {
    const searchParams = new URLSearchParams({ smartcrop: br.smartcrop, format: ext });
    const source = document.createElement('source');
    if (br.media) source.setAttribute('media', br.media);
    source.setAttribute('srcset', appendQueryParams(url, searchParams));
    picture.appendChild(source);
  });

  // append the default image eliminating smartcrop query param if present
  const img = document.createElement('img');
  img.setAttribute('loading', eager ? 'eager' : 'lazy');
  img.setAttribute('alt', alt);
  picture.appendChild(img);
  url.searchParams.delete('smartcrop');
  img.setAttribute('src', url.toString());

  picture.classList.add('smartcrop');
  return picture;
}

/**
 * to check if given src is a DM OpenAPI URL
 */
function isDMOpenAPIUrl(src) {
  return /^(https?:\/\/(.*)\/adobe\/assets\/urn:aaid:aem:(.*))/gm.test(src);
}

/**
 * to check if the page contains meta tag for smartcrop rendering
 */
function hasImageSmartcropMeta() {
  const metaTags = document.getElementsByTagName('meta');
  const matchingMeta = Array.from(metaTags).find((meta) => meta.name === 'smartcrop' && meta.content === 'true');
  return !!matchingMeta;
}

/**
 * to mark all the external images with smart crop on the page and set data-smartcrop-status=loading
 * if the image is a DM OpenAPI URL
 */
function markSmartCropImages(ele = document) {
  // Early return if smartcrop config is missing
  if (window.hlx?.aemassets?.smartCrops === undefined) {
    return;
  }

  // Collect all external images into an array
  const extImages = [];

  if (hasImageSmartcropMeta()) {
    // If smartcrop is enabled at page level, collect all <a> tags
    extImages.push(...ele.querySelectorAll('a'));
  } else {
    // if not enabled at page level, collect all <a> tags within block and section elements
    extImages.push(...ele.querySelectorAll('.smartcrop a'));
    ele.querySelectorAll('.section-metadata > div > div').forEach((sectionMeta) => {
      if (sectionMeta.innerText === 'smartcrop') {
        extImages.push(...sectionMeta.closest('.section-metadata').parentElement.querySelectorAll('a'));
      }
    });
  }

  // Apply the data-smartcrop-status attribute to all collected images if a DM OpenAPI URL
  extImages.forEach((extImage) => {
    if (isDMOpenAPIUrl(extImage.getAttribute('href'))) {
      extImage.setAttribute('data-smartcrop-status', 'loading');
    }
  });
}

/*
  * Decorates external images with a picture element
  * @param {Element} ele The element
  * @param {string} deliveryMarker The marker for external images
  * @private
  * @example
  * decorateExternalImages(main, '//External Image//');
  */
export function decorateExternalImages(ele, deliveryMarker) {
  // apply data-smartcrop-status=loading to all potential <a> tags
  markSmartCropImages(ele);

  const extImages = ele.querySelectorAll('a');
  extImages.forEach((extImage) => {
    if (isExternalImage(extImage, deliveryMarker)) {
      // check if needs to render smartcrop
      const renderSmartCrop = extImage.getAttribute('data-smartcrop-status');
      if (renderSmartCrop === 'loading') {
        const extPicture = createOptimizedPictureWithSmartcrop(extImage.getAttribute('href'));
        extPicture.setAttribute('data-smartcrop-status', 'loaded');
        extImage.parentNode.replaceChild(extPicture, extImage);
        return;
      }

      const extImageSrc = extImage.getAttribute('href');
      const extPicture = createOptimizedPicture({src: extImageSrc});

      /* copy query params from link to img */
      const extImageUrl = new URL(extImageSrc);
      const { searchParams } = extImageUrl;
      extPicture.querySelectorAll('source, img').forEach((child) => {
        if (child.tagName === 'SOURCE') {
          const srcset = child.getAttribute('srcset');
          if (srcset) {
            child.setAttribute('srcset', appendQueryParams(new URL(srcset, extImageSrc), searchParams));
          }
        } else if (child.tagName === 'IMG') {
          const src = child.getAttribute('src');
          if (src) {
            child.setAttribute('src', appendQueryParams(new URL(src, extImageSrc), searchParams));
          }
        }
      });
      extImage.parentNode.replaceChild(extPicture, extImage);
    }
  });
}

/**
 * Decorates all images in a container element and replace media urls with delivery urls.
 * @param {Element} ele The container element
 */
export function decorateImagesFromAlt(ele = document) {
  const pictureElements = ele.querySelectorAll('picture');
  [...pictureElements].forEach((pictureElement) => {
    const imgElement = pictureElement.querySelector('img');
    const alt = imgElement.getAttribute('alt');
    try {
      const deliveryObject = JSON.parse(decodeURIComponent(alt));
      const { deliveryUrl, altText } = deliveryObject;
      if (!deliveryUrl) {
        return;
      }

      const newPictureElement = isDMOpenAPIUrl(deliveryUrl)
        ? createOptimizedPictureWithSmartcrop(deliveryUrl, altText)
        : createOptimizedPicture({src: deliveryUrl, alt: altText});
      pictureElement.parentElement.replaceChild(newPictureElement, pictureElement);
    } catch (error) {
      // Do nothing
    }
  });
}

/**
 * Converts img tags to picture elements when their src URL matches a specified external prefix
 * @param {Element} ele The element
 * @param {string} externalurlprefix The prefix to match for external images
 * @example
 * decorateExternalImageswithprefix(main, 'https://example.com/assets/');
 */
export function decorateExternalImageswithprefix(ele, externalurlprefix) {
  const extImages = ele.querySelectorAll('img');
  extImages.forEach((extImage) => {
    const extImageSrc = extImage.getAttribute('src');
    if (extImageSrc && extImageSrc.startsWith(externalurlprefix)) {
      const extPicture = createOptimizedPicture({src: extImageSrc, imageFormat: 'avif' });

      /* copy query params from img to sources */
      const extImageUrl = new URL(extImageSrc);
      const { searchParams } = extImageUrl;
      extPicture.querySelectorAll('source, img').forEach((child) => {

        if (child.tagName === 'SOURCE') {
          const srcset = child.getAttribute('srcset');
          if (srcset) {
            child.setAttribute('srcset', appendQueryParams(new URL(srcset, extImageSrc), searchParams));
          }
        } else if (child.tagName === 'IMG') {
          const src = child.getAttribute('src');
          if (src) {
            child.setAttribute('src', appendQueryParams(new URL(src, extImageSrc), searchParams));
          }
        }
      });
      extImage.parentNode.replaceChild(extPicture, extImage);
    }
  });
}

export async function loadBlock(block) {
  const status = block.dataset.blockStatus;
  if (status !== 'loading' && status !== 'loaded') {
    block.dataset.blockStatus = 'loading';
    const { blockName } = block.dataset;
    try {
      let basePath = window.hlx.codeBasePath;
      if (window.hlx.aemassets.codeBasePath
        && window.hlx.aemassets.blocks.indexOf(blockName) !== -1) {
        basePath = `${window.hlx.codeBasePath}${window.hlx.aemassets.codeBasePath}`;
      }
      decorateExternalImages(block);
      decorateImagesFromAlt(block);
      const cssLoaded = loadCSS(`${basePath}/blocks/${blockName}/${blockName}.css`);
      const decorationComplete = new Promise((resolve) => {
        (async () => {
          try {
            const mod = await import(
              `${basePath}/blocks/${blockName}/${blockName}.js`
            );
            if (mod.default) {  
              await mod.default(block);
            }
          } catch (error) {
            // eslint-disable-next-line no-console
            console.log(`failed to load module for ${blockName}`, error);
          }
          resolve();
        })();
      });
      await Promise.all([cssLoaded, decorationComplete]);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log(`failed to load block ${blockName}`, error);
    }
    block.dataset.blockStatus = 'loaded';
  }
  return block;
}

// Create an object with the test functions
const testFunctions = {
  appendQueryParams,
  decorateImagesFromAlt,
};

// Export the object
export { testFunctions };
