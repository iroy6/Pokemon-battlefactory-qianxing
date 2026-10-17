param(
    [string]$ImageIndex,
    [string]$InputIndex,
    [string]$ContainerIndex,
    [string]$SourceFile
)
$ErrorActionPreference = 'Stop'
try {
    if (-not $ImageIndex) { $ImageIndex = Read-Host '请输入【像素矩形】模板的实际索引' }
    if (-not $InputIndex) { $InputIndex = Read-Host '请输入【输入区域】模板的实际索引' }
    if (-not $ContainerIndex) { $ContainerIndex = Read-Host '请输入【布局容器】模板的实际索引' }
    function Read-FactoryIndex([string]$Value, [string]$Label) {
        $Value = $Value.Trim()
        if ($Value -notmatch '^[0-9]{1,10}$') { throw "$Label 必须是编辑器中显示的整数索引。" }
        $Number = [uint64]::Parse($Value)
        if ($Number -eq 0 -or $Number -gt 4294967295) { throw "$Label 超出有效范围。" }
        return $Number.ToString([Globalization.CultureInfo]::InvariantCulture)
    }
    function Get-FactoryHash([string]$Path) {
        $Hasher = [Security.Cryptography.SHA256]::Create()
        try { return [BitConverter]::ToString($Hasher.ComputeHash([IO.File]::ReadAllBytes($Path))).Replace('-', '').ToLowerInvariant() }
        finally { $Hasher.Dispose() }
    }
    $ImageIndex = Read-FactoryIndex $ImageIndex '像素矩形'
    $InputIndex = Read-FactoryIndex $InputIndex '输入区域'
    $ContainerIndex = Read-FactoryIndex $ContainerIndex '布局容器'
    if (@(@($ImageIndex, $InputIndex, $ContainerIndex) | Select-Object -Unique).Count -ne 3) {
        throw '三个不同模板的索引不能相同，请重新核对。'
    }
    if (-not $SourceFile) {
        $SourceFile = Join-Path $PSScriptRoot 'lua/battle_factory_common_fx.lua'
    }
    $SourceFile = (Resolve-Path -LiteralPath $SourceFile).Path
    $Original = [IO.File]::ReadAllText($SourceFile)
    $Pattern = '(?m)(^loaders\["default_import_file/workspace/battle-factory/lua/battle_factory_mapping"\]=function\(require\)\r?\n)return \{image=[0-9]+,input=[0-9]+,container=[0-9]+,host=([0-9]+),entry=([0-9]+)\}'
    $MatchesFound = [regex]::Matches($Original, $Pattern)
    if ($MatchesFound.Count -ne 1) { throw '没有找到唯一的模板配置。请使用本交付包配套的 common_fx 脚本。' }
    $Match = $MatchesFound[0]
    $Replacement = $Match.Groups[1].Value + 'return {image=' + $ImageIndex + ',input=' + $InputIndex + ',container=' + $ContainerIndex + ',host=' + $Match.Groups[2].Value + ',entry=' + $Match.Groups[3].Value + '}'
    $Updated = $Original.Substring(0, $Match.Index) + $Replacement + $Original.Substring($Match.Index + $Match.Length)
    $OutputDir = Join-Path $PSScriptRoot ('校准输出-' + (Get-Date -Format 'yyyyMMdd-HHmmssfff') + '-' + [guid]::NewGuid().ToString('N').Substring(0, 6))
    [IO.Directory]::CreateDirectory($OutputDir) | Out-Null
    $OutputFile = Join-Path $OutputDir 'battle_factory_common_fx.lua'
    [IO.File]::WriteAllText($OutputFile, $Updated, (New-Object Text.UTF8Encoding($false)))
    $Record = [ordered]@{
        version = 'boot-v7.1-20mb'
        image = $ImageIndex; input = $InputIndex; container = $ContainerIndex
        sourceSha256 = Get-FactoryHash $SourceFile
        outputSha256 = Get-FactoryHash $OutputFile
        gameFilesModified = $false
        giaModified = $false
    }
    $Record | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $OutputDir '校准记录.json') -Encoding UTF8
    Write-Host "已生成：$OutputFile"
    Write-Host '请将此文件内容更新到千星中 common_fx 映射实际关联的本地文件，再保存关卡并重新试玩。'
    Write-Host '原脚本、GIA 和游戏目录没有被本工具修改。再次导入原 GIA 后，需要重新应用这次校准。'
} catch {
    Write-Error $_
    exit 1
}
