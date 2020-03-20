import { ArchiveReader } from './archive-reader';
import { getWasmModule } from './wasm-module';

let reader = null;
let busy = false;

getWasmModule((wasmModule) => {
    reader = new ArchiveReader(wasmModule);
    busy = false;
    self.postMessage({ type: 'READY', m_id: 0 });
});

self.onmessage = async ({ data: msg }) => {

    if (busy) {
        self.postMessage({ type: 'BUSY', m_id: msg.m_id });
        return;
    }

    let skipExtraction = false;
    busy = true;
    try {
        switch (msg.type) {
            case 'HELLO': // module will respond READY when it's ready
                break;
            case 'OPEN':
                await reader.open(msg.file);
                self.postMessage({ type: 'OPENED', m_id: msg.m_id });
                break;
            case 'LIST_FILES':
                skipExtraction = true;
            // eslint-disable-next-line no-fallthrough
            case 'EXTRACT_FILES':
                for (const entry of reader.entries(skipExtraction)) {
                    self.postMessage({ type: 'ENTRY', m_id: msg.m_id, entry });
                }
                self.postMessage({ type: 'END', m_id: msg.m_id });
                break;
            case 'EXTRACT_SINGLE_FILE':
                for (const entry of reader.entries(true, msg.target)) {
                    if (entry.fileData) {
                        self.postMessage({ type: 'FILE', m_id: msg.m_id, entry });
                    }
                }
                break;
            case 'CHECK_ENCRYPTION':
                self.postMessage({ type: 'ENCRYPTION_STATUS', m_id: msg.m_id, status: reader.hasEncryptedData() });
                break;
            case 'SET_PASSPHRASE':
                reader.setPassphrase(msg.passphrase);
                self.postMessage({ type: 'PASSPHRASE_STATUS', m_id: msg.m_id, status: true });
                break;
            case 'SET_ENCODING':
                reader.setEncoding(msg.encoding);
                self.postMessage({ type: 'ENCODING_STATUS', m_id: msg.m_id, status: true });
                break;
            default:
                throw new Error('Invalid Command');
        }
    } catch (err) {
        self.postMessage({
            type: 'ERROR', m_id: msg.m_id,
            error: {
                message: err.message,
                name: err.name,
                stack: err.stack
            }
        });
    } finally {
        // eslint-disable-next-line require-atomic-updates
        busy = false;
    }
};