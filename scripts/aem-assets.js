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
 * Checks if a URL has a supported image extension
 * @param {string} url The URL to check
 * @returns {boolean} Whether the URL has a supported image extension
 * @private
 */
function hasImageExtension(url) {
  if (!url) return false;
  const ext = getUrlExtension(url);
  return ext && ['jpg', 'jpeg', 'png', 'gif', 'webp','avif'].includes(ext.toLowerCase());
}

/**
 * Gets the source URL from an element based on its tag name
 * @param {Element} element The element (img or a)
 * @returns {string|null} The source URL from src or href attribute
 * @private
 */
function getImageSrcUrl(element) {
  if (element.tagName === 'IMG') {
    return element.getAttribute('src');
  } else if (element.tagName === 'A') {
    return element.getAttribute('href');
  }
  return null;
}

/**
 * Checks if an element is an external image.
 * @param {Element} element The element
 * @param {string} externalImageMarker The marker for external images
 * @returns {Object} Object containing isExternal (boolean) and createOptimizedPictureHandler (function or null)
 * @private
 */
function isExternalImage(element, externalImageMarker) {
  
  // Skip images that are inside picture elements
  if (element.tagName === 'IMG' && element.closest('picture')) {
    return { isExternal: false, createOptimizedPictureHandler: null };
  }

  // For img tags, check if URL matches any external image URL prefix
  if (element.tagName === 'IMG') {
    const url = getImageSrcUrl(element);
    if (!url) return { isExternal: false, createOptimizedPictureHandler: null };
    
    // Check if matches any external image URL prefix
    let createOptimizedPictureHandler = null;
    let isExternalUrl = false;
    
    // Iterate through the prefixes to find a match
    for (const prefixItem of window.hlx.aemassets.externalImageUrlPrefixes) {
      // If prefixItem is a tuple [prefix, creatorType]
      if (Array.isArray(prefixItem) && prefixItem.length === 2) {
        const [prefix, createOptimizedPictureHandlerFunction] = prefixItem;
        if (url.startsWith(prefix)) {
          isExternalUrl = true;
          createOptimizedPictureHandler = createOptimizedPictureHandlerFunction
          break;
        }
      }
    }
    
    if (!isExternalUrl) return { isExternal: false, createOptimizedPictureHandler: null };
    
    return { isExternal: hasImageExtension(url), createOptimizedPictureHandler };
  }

  // Handle anchor elements with marker text
  if (element.tagName === 'A' && element.textContent.trim() === externalImageMarker) {
    return { isExternal: true, createOptimizedPictureHandler: createOptimizedPicture };
  }
  
  // Handle anchor elements based on URL
  if (element.tagName === 'A') {
    const url = getImageSrcUrl(element);
    if (!url) return { isExternal: false, createOptimizedPictureHandler: null };
    
    // Determine which picture creator to use based on URL patterns
    let createOptimizedPictureHandler = createOptimizedPicture;
    return { isExternal: hasImageExtension(url), createOptimizedPictureHandler };
  }
  
  // Not an img or anchor element
  return { isExternal: false, createOptimizedPictureHandler: null };
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
 * @returns {Element} The picture element
 *
 */
export function createOptimizedPicture(src, alt = '', eager = false, breakpoints = [{ media: '(min-width: 600px)', width: '2000' }, { width: '750' }] ) {
  const url = new URL(src);
  const picture = document.createElement('picture');
  const { pathname } = url;
  const ext = pathname.substring(pathname.lastIndexOf('.') + 1);

  // webp
  breakpoints.forEach((br) => {
    const source = document.createElement('source');
    if (br.media) source.setAttribute('media', br.media);
    source.setAttribute('type', 'image/webp');
    const searchParams = new URLSearchParams({ width: br.width, format: 'webply' });
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
 * @param {string} imageFormat The image format to use
 * @returns {Element} The picture element
 */
export function createOptimizedPictureWithSmartcrop(
  src,
  alt = '',
  eager = false,
  breakpoints = []
) {
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
 * Creates an optimized picture element for Scene7 images.
 * @param {string} src The image source URL
 * @param {string} alt The image alt text
 * @param {boolean} eager Whether to load the image eagerly
 * @param {object[]} breakpoints The breakpoints to use
 * @returns {Element} The picture element
 *
 */
export function createOptimizedPictureForDM(
  src,
  alt = '',
  eager = false,
  breakpoints = [{ media: '(min-width: 600px)', width: '2000' }, { width: '750' }]
) {
  
  const picture = document.createElement('picture');
  const url = new URL(src);

  // jpeg sources
  breakpoints.forEach((br) => {
    const source = document.createElement('source');
    if (br.media) source.setAttribute('media', br.media);
    source.setAttribute('type', 'image/jpeg');
    const searchParams = new URLSearchParams({ width: br.width });
    source.setAttribute('srcset', appendQueryParams(url, searchParams));
    picture.appendChild(source);
  });

  // fallback
  breakpoints.forEach((br, i) => {
    const searchParams = new URLSearchParams({ width: br.width });

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
 * Creates an optimized picture element for DM OpenAPI images.
 * @param {string} src The image source URL
 * @param {string} alt The image alt text
 * @param {boolean} useSmartcrop Whether to use smartcrop
 * @param {boolean} eager Whether to load the image eagerly
 * @param {object[]} breakpoints The breakpoints to use
 * @returns {Element} The picture element
 *
 */
export function createOptimizedPictureForDMOpenAPI(
  src,
  alt = '',
  useSmartcrop = false,
  eager = false,
  breakpoints = [{ media: '(min-width: 600px)', width: '2000' }, { width: '750' }]
) {
  const picture = document.createElement('picture');
  const isAbsoluteUrl = /^https?:\/\//i.test(src);
  const url = isAbsoluteUrl ? new URL(src) : new URL(src, window.location.href);
  
  // Determine which breakpoints to use
  let finalBreakpoints = breakpoints;
  if (useSmartcrop && window.hlx?.aemassets?.smartCrops && breakpoints.length === 0) {
    finalBreakpoints = Object.entries(window.hlx.aemassets.smartCrops).map(
      ([name, { minWidth, maxWidth }]) => ({
        media: `(min-width: ${minWidth}px) and (max-width: ${maxWidth}px)`,
        smartcrop: name,
        width: maxWidth || '2000',
      })
    );
  }

  // Create sources
  finalBreakpoints.forEach((br) => {
    const source = document.createElement('source');
    if (br.media) source.setAttribute('media', br.media);
    source.setAttribute('type', 'image/avif');
    
    const searchParams = new URLSearchParams({ width: br.width || '2000' });
    if (useSmartcrop && br.smartcrop) {
      searchParams.set('smartcrop', br.smartcrop);
    }
    
    source.setAttribute('srcset', appendQueryParams(url, searchParams));
    picture.appendChild(source);
  });

  // Create fallback sources (for non-last breakpoints)
  finalBreakpoints.forEach((br, i) => {
    if (i < finalBreakpoints.length - 1) {
      const source = document.createElement('source');
      if (br.media) source.setAttribute('media', br.media);
      
      const searchParams = new URLSearchParams({ width: br.width || '2000' });
      if (useSmartcrop && br.smartcrop) {
        searchParams.set('smartcrop', br.smartcrop);
      }
      
      source.setAttribute('srcset', appendQueryParams(url, searchParams));
      picture.appendChild(source);
    }
  });

  // Create default img element (from last breakpoint or without smartcrop)
  const img = document.createElement('img');
  img.setAttribute('loading', eager ? 'eager' : 'lazy');
  img.setAttribute('alt', alt || '');
  picture.appendChild(img);
  
  // For the image src, either use the last breakpoint or a clean URL
  if (finalBreakpoints.length > 0) {
    const lastBreakpoint = finalBreakpoints[finalBreakpoints.length - 1];
    const searchParams = new URLSearchParams({ width: lastBreakpoint.width || '2000' });
    img.setAttribute('src', appendQueryParams(url, searchParams));
  } else {
    img.setAttribute('src', url.toString());
  }

  // Add smartcrop class if using smartcrop
  if (useSmartcrop) {
    picture.classList.add('smartcrop');
    picture.setAttribute('data-smartcrop-status', 'loaded');
  }

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
    // If smartcrop is enabled at page level, collect all <a> tags and standalone <img> tags
    extImages.push(...ele.querySelectorAll('a'));
    // Add img tags that are not inside picture elements
    ele.querySelectorAll('img').forEach(img => {
      if (!img.closest('picture')) {
        extImages.push(img);
      }
    });
  } else {
    // if not enabled at page level, collect all <a> tags and standalone <img> tags within block and section elements
    extImages.push(...ele.querySelectorAll('.smartcrop a'));
    // Add img tags that are not inside picture elements
    ele.querySelectorAll('.smartcrop img').forEach(img => {
      if (!img.closest('picture')) {
        extImages.push(img);
      }
    });
    ele.querySelectorAll('.section-metadata > div > div').forEach((sectionMeta) => {
      if (sectionMeta.innerText === 'smartcrop') {
        const parentSection = sectionMeta.closest('.section-metadata').parentElement;
        extImages.push(...parentSection.querySelectorAll('a'));
        // Add img tags that are not inside picture elements
        parentSection.querySelectorAll('img').forEach(img => {
          if (!img.closest('picture')) {
            extImages.push(img);
          }
        });
      }
    });
  }

  // Apply the data-smartcrop-status attribute to all collected images if a DM OpenAPI URL
  extImages.forEach((extImage) => {
    const src = getImageSrcUrl(extImage);
    if (src && isDMOpenAPIUrl(src)) {
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

  const extImages = ele.querySelectorAll('a,img');
  extImages.forEach((extImage) => {
    const { isExternal, createOptimizedPictureHandler } = isExternalImage(extImage, deliveryMarker);
    if (isExternal) {
      // check if needs to render smartcrop
      const renderSmartCrop = extImage.getAttribute('data-smartcrop-status');
      const extImageSrc = getImageSrcUrl(extImage);
      
      if (!extImageSrc) return; // Skip if no source found

      // Use the provided picture creator function or fall back to default
      let extPicture;
      if (createOptimizedPictureHandler) {
        const useSmartcrop = renderSmartCrop === 'loading';
        extPicture = createOptimizedPictureHandler(extImageSrc,null,useSmartcrop);
      } else {  
        // if smartcrop is loading, render smartcrop
        if (renderSmartCrop === 'loading') {
          const extPicture = createOptimizedPictureWithSmartcrop(extImageSrc);
          extPicture.setAttribute('data-smartcrop-status', 'loaded');
          extImage.parentNode.replaceChild(extPicture, extImage);
          return;
        }

        extPicture = createOptimizedPicture(extImageSrc);
      }

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
        ? createOptimizedPictureForDMOpenAPI(deliveryUrl, altText,true,)
        : createOptimizedPictureForDM(deliveryUrl,altText);
      
      pictureElement.parentElement.replaceChild(newPictureElement, pictureElement);
    } catch (error) {
      // Do nothing
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
