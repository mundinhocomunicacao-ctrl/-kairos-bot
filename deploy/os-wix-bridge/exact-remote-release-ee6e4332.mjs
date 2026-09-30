// Runtime-only consumer. Heavy vinext build is executed by the Render build-stage artifact service.
import {execFileSync,spawn} from 'node:child_process';
import process from 'node:process';
execFileSync('git',['submodule','sync','--recursive','os'],{stdio:'inherit'});
execFileSync('git',['submodule','update','--init','--recursive','os'],{stdio:'inherit'});
const child=spawn(process.execPath,['os/scripts/os-consume-wix-artifact.mjs'],{cwd:process.cwd(),env:process.env,stdio:'inherit'});
child.on('error',()=>process.exit(1));
child.on('exit',code=>process.exit(code||0));
