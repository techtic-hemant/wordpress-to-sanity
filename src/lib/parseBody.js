const { JSDOM } = require('jsdom')
const blockTools = require('@sanity/block-tools').default
const sanitizeHTML = require('./sanitizeHTML')
const defaultSchema = require('../../schema/defaultSchema')

const blockContentType = defaultSchema
  .get('blogPost')
  .fields.find(field => field.name === 'body').type

const {autop} = require('./autop');


function htmlToBlocks (html, options) {
  if (!html) {
    return []
  }

  html = html.replace(/\[.*?\]/g, "");
  html = autop(html);
 // html = html.replace(/\[(\S+)[^\]]*][^\[]*\[\/\1\]/g, '');


  const blocks = blockTools.htmlToBlocks(sanitizeHTML(html), blockContentType, {
    parseHtml: htmlContent => new JSDOM(htmlContent).window.document,
    rules: [
      {
        deserialize (el, next, block) {
          // Special case for code blocks (wrapped in pre and code tag)
          if (el.tagName.toLowerCase() !== 'pre') {
            return undefined
          }
          const code = el.children[0]
          let text = ''
          if (code) {
            const childNodes =
              code && code.tagName.toLowerCase() === 'code'
                ? code.childNodes
                : el.childNodes
            childNodes.forEach(node => {
              text += node.textContent
            })
          } else {
            text = el.textContent
          }
          if(!text) {
            return undefined
          }
          return block({
            children: [],
            _type: 'code',
            text: text
          })
        }
      },
      {
        deserialize (el, next, block) {
          if (el.tagName === 'IMG') {
            /* return block({
                _type: 'image',
                _sanityAsset: `image@${el
                  .getAttribute('src')
                  //.replace(/^\/\//, 'http://')
                }`
            }) */
            return {
              "_sanityAsset": `image@${el
                .getAttribute('src')
                }`, "_type": "image" }
          }

          /* if (
            el.tagName.toLowerCase() === 'p' &&
            el.childNodes.length === 1 &&
            el.childNodes.tagName &&
            el.childNodes[0].tagName.toLowerCase() === 'img'
          ) {
             return block({
                _sanityAsset: `image@${el.childNodes[0]
                  .getAttribute('src')
                  //.replace(/^\/\//, 'https://')
                }`
            })
          } */
          return undefined
        }
      }
    ],
  })
  return blocks
}

module.exports = bodyHTML => htmlToBlocks(bodyHTML)
