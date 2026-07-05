import { exec } from 'child_process';
import { existsSync, mkdirSync, writeFile } from 'fs';
import { join } from 'path';

exec('dotnet-gitversion', (error, stdout) => {
  if (error) {
    console.error(`exec error: ${error}`);
    return;
  }

  // Parse the GitVersion output
  const versionInfo = JSON.parse(stdout);

  // Define the path to the public directory and the version.json file
  // eslint-disable-next-line no-undef
  const publicDirPath = join(__dirname, '..', '..', 'public');
  const versionFilePath = join(publicDirPath, 'version.json');
  // Ensure the public directory exists
  if (!existsSync(publicDirPath)) {
    mkdirSync(publicDirPath, { recursive: true });
  }

  // Data to write to version.json
  const dataToWrite = {
    SemVer: versionInfo.SemVer,
    BranchName: versionInfo.BranchName,
  };

  console.log(dataToWrite);

  // Write the version information to the version.json file
  writeFile(versionFilePath, JSON.stringify(dataToWrite, null, 2), (err) => {
    if (err) throw err;
    console.log(`Version info written to ${versionFilePath}`);
  });
});
