// Put the OceanX icon and version details into OceanX POS.exe (works on any build machine, no Wine needed).
const fs = require('node:fs');
const path = require('node:path');

exports.default = async function afterPack(ctx) {
  if (ctx.electronPlatformName !== 'win32') return;
  const ResEdit = await import('resedit');
  const { NtExecutable, NtExecutableResource, Resource, Data } = ResEdit.default ?? ResEdit;
  const name = ctx.packager.appInfo.productFilename;
  const exePath = path.join(ctx.appOutDir, `${name}.exe`);
  const exe = NtExecutable.from(fs.readFileSync(exePath), { ignoreCert: true });
  const res = NtExecutableResource.from(exe);
  const ico = Data.IconFile.from(fs.readFileSync(path.join(__dirname, 'icon.ico')));
  Resource.IconGroupEntry.replaceIconsForResource(
    res.entries,
    1,
    1033,
    ico.icons.map((i) => i.data),
  );
  const [vi] = Resource.VersionInfo.fromEntries(res.entries);
  const version = ctx.packager.appInfo.version;
  const [a, b, c] = version.split('.').map(Number);
  vi.setFileVersion(a, b, c, 0, 1033);
  vi.setProductVersion(a, b, c, 0, 1033);
  vi.setStringValues(
    { lang: 1033, codepage: 1200 },
    { FileDescription: 'OceanX POS', ProductName: 'OceanX POS', CompanyName: 'OceanX', OriginalFilename: `${name}.exe`, LegalCopyright: `© ${new Date().getFullYear()} OceanX` },
  );
  vi.outputToResourceEntries(res.entries);
  res.outputResource(exe);
  fs.writeFileSync(exePath, Buffer.from(exe.generate()));
};
