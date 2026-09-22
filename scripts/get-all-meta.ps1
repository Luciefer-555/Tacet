$shell = New-Object -ComObject Shell.Application
$folderPath = "C:\Users\saipr\Downloads\Sync-in\public"
$folder = $shell.Namespace($folderPath)
$file = $folder.ParseName("hero-touch.mp4")

0..320 | ForEach-Object {
    $header = $folder.GetDetailsOf($null, $_)
    $val = $folder.GetDetailsOf($file, $_)
    if ($val) {
        [PSCustomObject]@{ Index = $_; Property = $header; Value = $val }
    }
} | Format-Table -AutoSize
