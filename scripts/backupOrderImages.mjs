import fs from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({path:'.env.local',quiet:true})
const directory=process.argv[2]
if(!directory?.startsWith('backups/'))throw new Error('Expected a local backup directory')
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY)
const paths=[]
async function walk(prefix=''){
  for(let offset=0;;offset+=100){
    const {data,error}=await db.storage.from('order-images').list(prefix,{limit:100,offset,sortBy:{column:'name',order:'asc'}})
    if(error)throw error
    for(const item of data){const key=prefix?`${prefix}/${item.name}`:item.name;if(item.id)paths.push(key);else await walk(key)}
    if(data.length<100)break
  }
}
await walk()
await fs.writeFile(`${directory}/storage-manifest.json`,JSON.stringify(paths,null,2))
let index=0,done=0
await Promise.all(Array.from({length:6},async()=>{
  while(index<paths.length){
    const key=paths[index++]
    const target=path.resolve(directory,'order-images',key)
    const base=path.resolve(directory,'order-images')+path.sep
    if(!target.startsWith(base))throw new Error('Unexpected storage path')
    const {data,error}=await db.storage.from('order-images').download(key)
    if(error)throw error
    const content=Buffer.from(await data.arrayBuffer())
    await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,content)
    if((await fs.stat(target)).size!==content.length)throw new Error('Image backup verification failed')
    done++;if(done%100===0)console.log(`Backed up ${done}/${paths.length} images`)
  }
}))
console.log(`Verified ${done} image backups`)
