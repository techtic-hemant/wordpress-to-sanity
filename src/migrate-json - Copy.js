#!/usr/bin/env node

/* eslint-disable id-length, no-console, no-process-env, no-sync, no-process-exit */
const fs = require('fs')
const parseDate = require('./lib/parseDate')
const parseBody = require('./lib/parseBody')
const slugify = require('slugify');
const ndjson = require('ndjson')

function generateAuthorId(id) {
    return `author-${id}`
}

function generateCategoryId(id) {
    return `category-${id}`
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
        const { title, category, link: permalink, description } = item;
        let body;
          try{
            body = parseDate(item.encoded.map((desc) => desc.__cdata).join("\n"));
          }catch{
            body = ""
          }
        let user = users.find(user => user.slug.current ===  slugify( item.creator.__cdata, { lower: true }));
        return {
            _type: 'post',
            title,
            description,
            body,
            publishedAt: parseDate(item),
            slug: {
              current: slugify(title, { lower: true })
            },
            categories: categories.map((category)=>{
              return {
                _type: 'reference',
                _ref: generateCategoryId(category._nicename)
              };
            }),
            author: user ? ({
              _type: 'reference',
              _ref: user._id
            }) : {},
          }
      })
    }

    const output = [
        /* meta, */
        ...users, ...posts, ...categories
    ]
    return output

}
async function main() {

  ['data/post-events.json', 'data/post-news.json', 'data/post-work.json'].forEach(async filename => {
    const json = await getJsonFromFile(__dirname + "/" + filename);
    const output = await buildJSON(json);

    //let data = JSON.stringify(output, null, '\t');

    // console.log("File saved : " + filename + ".json");
    // fs.writeFileSync(__dirname + "/" + filename+".json" , data);

    const serialize = ndjson.serialize();

    var ndjsonData = [];
    serialize.on('data', (line) => {
      ndjsonData.push(line);
    })

    serialize.on('end', (end) => {
      fs.writeFileSync(__dirname + "/" + filename + ".ndjson", ndjsonData.join(""));
      console.log("File saved : " + filename + ".ndjson");
    })

    for (var i = output.length - 1; i >= 0; i--) {
      serialize.write(output[i])
    }

    serialize.end();
  });
}
main()