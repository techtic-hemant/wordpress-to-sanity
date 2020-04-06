#!/usr/bin/env node

/* eslint-disable id-length, no-console, no-process-env, no-sync, no-process-exit */
const fs = require('fs')
const parseDate = require('./lib/parseDate')
const parseBody = require('./lib/parseBody')
//const slugify = require('slugify');
const ndjson = require('ndjson')
const PHP = require('./lib/PHP')

function generateAuthorId(id) {
    return `author-${id}`
}

function generateCategoryId(id) {
    return `category-${id}`
}

function slugify( str ) {

  //replace all special characters | symbols with a space
  str = str.replace(/[`~!@#$%^&*()_\-+=\[\]{};:'"\\|\/,.<>?\s]/g, ' ').toLowerCase();

  // trim spaces at start and end of string
  str = str.replace(/^\s+|\s+$/gm,'');

  // replace space with dash/hyphen
  str = str.replace(/\s+/g, '-');
  return str;
}

function getJsonFromFile(path = '') {
    if (!path) {
        return console.error('You need to set path')
    }
    let rawdata = fs.readFileSync(path);
    return JSON.parse(rawdata);
}
async function buildJSON(json) {
    const channel = json.channel ? json.channel : json.rss.channel
    // const {
    //     rss: {
    //         channel
    //     }
    // } = json;

    const meta = {
      rootUrl: channel.base_site_url.__text
    };



    /**
     * Get the categories
     */

    let categories = [];

    if(channel.category && channel.category.length > 0){
      categories = channel.category.map(function(item){
        return {
                _type: 'category',
                //_id: item.term_id.__text,
                _id: generateCategoryId(item.category_nicename.__cdata),
                title: item.cat_name.__cdata
            }
      })
    }

    /**
     * Get the users
     */
    let users = [];

    if(channel.author && channel.author.length > 0){
      users = channel.author.map((item)=>{
        return {
              _type: 'author',
              _id: generateAuthorId(item.author_id.__text),
              name: item.author_display_name.__cdata,
              slug: {
                current: slugify(item.author_login.__cdata, { lower: true })
              },
              email: item.author_email.__cdata
            }
      })
    }

    /**
     * Get the posts
     */
    let posts = [];

    if(channel.item && channel.item.length > 0){
      posts = channel.item.map((item)=>{
        const { title, category, post_name, post_id, postmeta } = item;
        let body;
        try {
          body = parseBody(item.encoded.map((desc) => desc.__cdata).join("\n"));
        } catch {
          body = ""
        }
        let user = users.find(user => user.slug.current ===  slugify( item.creator.__cdata, { lower: true }));

        let gallery_meta = postmeta.filter((meta)=>{
          return meta.meta_key.__cdata == '_pgl_post_gallery';
        });

        let video_meta = postmeta.filter((meta)=>{
          return meta.meta_key.__cdata == '_pgl_post_video';
        });

        let cover = {};
        if(gallery_meta.length > 0){
          gallery_images = gallery_meta[0].meta_value.__cdata;
          gallery_images = PHP.parse(gallery_images);

          gallery_images = Object.values(gallery_images);

          if(gallery_images.length > 0){
            cover = {
              _type: "image",
              _sanityAsset: `image@${gallery_images[0]}`,
            }
          }
        }

        let video_link = '';
        if (video_meta.length > 0) {
          video_link = video_meta[0].meta_value.__cdata;
        }

        return {
            _type: 'post',
            _id: post_id.__text,
            title,
            body,
            video_link: video_link,
            // cover,
            publishedAt: parseDate(item),
            slug: {
              current: post_name.__cdata
            },
            categories: category.filter((cat)=>{
              return cat._domain === 'category'
            }).map((cat)=>{

              found = categories.filter((category)=>{
                return generateCategoryId(cat._nicename) == category._id
              })
              if(found.length == 0){
                categories.push({
                      _type: 'category',
                      _id: generateCategoryId(cat._nicename),
                      title: cat.__cdata
                  })
              }
              return {
                _type: 'reference',
                _ref: generateCategoryId(cat._nicename)
              };
            }),
            author: user ? ({
              _type: 'reference',
              _ref: user._id
            }) : {},
          }
      })
    }


    //console.log(categories);

    const output = [
        /* meta, */
         ...categories, ...users, ...posts
    ]
    return output

}
async function main() {

  ['post-events.json', 'post-news.json', 'post-work.json'].forEach(async filename => {
    const json = await getJsonFromFile(__dirname + "/data/" + filename);
    const output = await buildJSON(json);

    let data = JSON.stringify(output, null, '\t');

    for (var i = 0; i < data.length; i++) {
      console.log(data[i]['_type'])
    }

    // console.log("File saved : " + filename + ".json");
    // fs.writeFileSync(__dirname + "/" + filename+".json" , data);
    fs.writeFileSync(__dirname + "/data/" + filename + ".json", data);
    const serialize = ndjson.serialize();

    var ndjsonData = [];
    serialize.on('data', (line) => {
      ndjsonData.push(line);
    })

    serialize.on('end', (end) => {
      fs.writeFileSync(__dirname + "/data/ndjson/" + filename + ".ndjson", ndjsonData.join(""));
      console.log("File saved : " + filename + ".ndjson");
    })

    for (var i = output.length - 1; i >= 0; i--) {
      serialize.write(output[i])
    }

    serialize.end();
  });
}
main()