import fs from 'fs-extra';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

async function release() {
    try {
        // Clean dist directory
        await fs.remove('dist');
        await fs.mkdir('dist');

        // Run production build
        console.log('Building plugin...');
        await execAsync('npm run build');

        // Create release package
        const manifest = await fs.readJson('manifest.json');
        const outFileName = `obsidian-asana-plugin-${manifest.version}.zip`;
        
        // Create zip file
        console.log('Creating release package...');
        await execAsync(`cd dist && zip -r ${outFileName} ./*`);

        console.log(`Release package created: dist/${outFileName}`);
    } catch (error) {
        console.error('Error creating release:', error);
        process.exit(1);
    }
}

release();
