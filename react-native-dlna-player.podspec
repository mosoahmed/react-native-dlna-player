# react-native-dlna-player.podspec

require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "react-native-dlna-player"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.description  = <<-DESC
                  react-native-dlna-player
                   DESC
  s.homepage     = "https://github.com/472647301/react-native-dlna-player"
  # brief license entry:
  s.license      = "MIT"
  # optional - use expanded license entry instead:
  # s.license    = { :type => "MIT", :file => "LICENSE" }
  s.authors      = { "Byron" => "byron.zhuwenbo@gmail.com" }
  s.platforms    = { :ios => "13.0", :tvos => "13.0" }
  s.source       = { :git => "https://github.com/472647301/react-native-dlna-player.git", :tag => "#{s.version}" }

  s.source_files = "ios/**/*.{h,c,cc,cpp,m,mm,swift}"
  s.requires_arc = true

  s.vendored_frameworks = 'Neptune.framework', 'Platinum.framework'

  # Exclude x86_64 architecture (old Intel Macs) - use arm64 only
  s.pod_target_xcconfig = {
    'EXCLUDED_ARCHS[sdk=iphonesimulator*]' => 'x86_64'
  }
  s.user_target_xcconfig = {
    'EXCLUDED_ARCHS[sdk=iphonesimulator*]' => 'x86_64'
  }

  s.dependency "React"
  # VLC Player disabled - not needed for DLNA casting
  # s.dependency 'MobileVLCKit', '3.3.17'
end

