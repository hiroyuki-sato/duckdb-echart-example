import './style.css'
import typescriptLogo from './typescript.svg'
import viteLogo from '/vite.svg'
import { setupCounter } from './counter.mts'
// echart
import * as echarts from 'echarts';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <a href="https://vite.dev" target="_blank">
      <img src="${viteLogo}" class="logo" alt="Vite logo" />
    </a>
    <a href="https://www.typescriptlang.org/" target="_blank">
      <img src="${typescriptLogo}" class="logo vanilla" alt="TypeScript logo" />
    </a>
    <h1>Vite + TypeScript</h1>
    <div class="card">
      <button id="counter" type="button"></button>
    </div>
    <p class="read-the-docs">
      Click on the Vite and TypeScript logos to learn more
    </p>
  </div>
`

setupCounter(document.querySelector<HTMLButtonElement>('#counter')!)


/////////////////////////////////////////////////////////
// duckdb
/////////////////////////////////////////////////////////
// https://duckdb.org/docs/stable/clients/wasm/instantiation#vite
// duckdb loads wasm data using fech() methods.
// So, some components need `?url` suffiex explicitly.
//
import * as duckdb from '@duckdb/duckdb-wasm';
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import mvp_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import duckdb_wasm_eh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import eh_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';

const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
    mvp: {
        mainModule: duckdb_wasm,
        mainWorker: mvp_worker,
    },
    eh: {
        mainModule: duckdb_wasm_eh,
        mainWorker: eh_worker,
    },
};
// Select a bundle based on browser checks
const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
// Instantiate the asynchronus version of DuckDB-wasm
const worker = new Worker(bundle.mainWorker!);
const logger = new duckdb.ConsoleLogger();
const db = new duckdb.AsyncDuckDB(logger, worker);
await db.instantiate(bundle.mainModule, bundle.pthreadWorker);


const VERSION_SQL = "SELECT version() AS version;";
const conn = await db.connect()
//await conn.query(VERSION_SQL)

const version = await db.getVersion();
console.log("duckdb version");
console.log(version);

//Error: IO Error: Extension https://nightly-extensions.duckdb.org/v1.3.0/wasm_eh/excel.duckdb_extension.wasm is not available
await conn.query(`
  INSTALL excel FROM core_nightly;
  LOAD excel;
`);

//await conn.query(`
//  INSTALL excel;
//  LOAD excel;
//`);
await conn.close()


/////////////////////////////////////////////////////////
/// echarts
/////////////////////////////////////////////////////////

const chartDom = document.getElementById('chart')!;
const myChart = echarts.init(chartDom);

const option = {
  title: {
    text: 'ECharts 入門'
  },
  tooltip: {},
  xAxis: {
    data: ['A', 'B', 'C']
  },
  yAxis: {},
  series: [{
    name: 'スコア',
    type: 'bar',
    data: [5, 20, 36]
  }]
};

myChart.setOption(option);

///////////////////////////////////////////////////
// Upload file
///////////////////////////////////////////////////

async function uploadFileToOPFS(): Promise<void> {

    const [fileHandle] = await window.showOpenFilePicker();
    const file = await fileHandle.getFile();

    const opfsRoot = await navigator.storage.getDirectory();

    const opfsFileHandle = await opfsRoot.getFileHandle(file.name, { create: true });
    const writable = await opfsFileHandle.createWritable();

    await writable.write(file);
    await writable.close();

    console.log(`Save file: ${file.name}`);
}


const button = document.querySelector<HTMLButtonElement>('#upload');
if (button) {
    console.log("click test");
    button.addEventListener('click', uploadFileToOPFS);
}

///////////////////////////////////////////////////
// ls file
///////////////////////////////////////////////////

async function listOPFSFiles(): Promise<void> {
  const root = await navigator.storage.getDirectory();

  console.log('list OPFS files');
  for await (const [name, handle] of root.entries()) {
    if (handle.kind === 'file') {
      console.log(`F ${name}`);
    } else if (handle.kind === 'directory') {
      console.log(`D ${name}/`);
    }
  }
}

const listButton = document.querySelector<HTMLButtonElement>('#list');
if (listButton) {
    console.log("click test");
    listButton.addEventListener('click', listOPFSFiles);
}

///////////////////////////////////////////////////
// remove all files
///////////////////////////////////////////////////
async function clearOPFS(): Promise<void> {
  // https://developer.mozilla.org/ja/docs/Web/API/File_System_API/Origin_private_file_system
  await (await navigator.storage.getDirectory()).remove({ recursive: true });
  console.log('All files deleted');
}

const delButton = document.querySelector<HTMLButtonElement>('#delete');
if (delButton) {
    console.log("del button");
    delButton.addEventListener('click', clearOPFS);
}

///////////////////////////////////////////////////
// plot data
///////////////////////////////////////////////////
async function doPlot(): Promise<void> {
  try {
    console.log("plot button");

    const conn = await db.connect()
    const file = 'data.xlsx'
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle(file);

    console.log("read contents");
    const fobj = await handle.getFile();
    console.log("File Size", fobj.size);
    const buffer = await fobj.arrayBuffer();
    console.log("Buffer: ", buffer.byteLength);
    const u8array = new Uint8Array(buffer);
    console.log(u8array);

    await db.registerFileBuffer('data.xlsx', new Uint8Array(buffer));

    console.log("before query");
    const result = await conn.query(`select * from read_xlsx('data.xlsx');`);
    console.log(result.toArray()[0].count);
    console.log(result.toString());

    console.log(result)
  } catch (error) {
    console.log("doPost Error: ", error);
  } finally {
    console.log("Finally called");
    await db.dropFile('data.xlsx');
    await conn.close();
  }
}

const plotButton = document.querySelector<HTMLButtonElement>('#plot');
if (plotButton) {
    plotButton.addEventListener('click', doPlot);
}

