const ffmpegPath = require('ffmpeg-static');

const getVideoDuration = (videoPath) => {
  return new Promise((resolve, reject) => {
    const command = `"${ffmpegPath}" -i "${videoPath}" 2>&1`;
    require("child_process").exec(command, (error, stdout) => {
      if (error) {
        const match = stdout.match(/Duration:\s(\d+):(\d+):(\d+\.\d+)/);
        if (match) {
          const hours = parseInt(match[1]);
          const minutes = parseInt(match[2]);
          const seconds = parseFloat(match[3]);
          const totalSeconds = hours * 3600 + minutes * 60 + seconds;
          resolve(totalSeconds);
        } else {
          reject(new Error("Không thể lấy thời lượng video"));
        }
      } else {
        reject(new Error("ffmpeg không trả về output mong muốn"));
      }
    });
  });
};

module.exports = getVideoDuration;