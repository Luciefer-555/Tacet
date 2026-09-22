$shell = New-Object -ComObject Shell.Application
$folderPath = "C:\Users\saipr\Downloads\Sync-in\public"
$folder = $shell.Namespace($folderPath)
$file = $folder.ParseName("hero-touch.mp4")

0..320 | ForEach-Object {
    $header = $folder.GetDetailsOf($null, $_)
    $val = $folder.GetDetailsOf($file, $_)
    if ($val -and ($header -match 'Width|Height|Dimensions|Resolution|Bit rate|Data rate|Frame rate|Length|Total bitrate|Size')) {
        [PSCustomObject]@{ Property = $header; Value = $val }
    }
} | Format-Table -AutoSize
