// Helper để chạy lệnh ffmpeg
const execPromise = (command) => {
  return new Promise((resolve, reject) => {
    require("child_process").exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error("Exec error: ", error);
        console.error("stderr: ", stderr); // Log stderr để xem chi tiết lỗi
        reject(`Error: ${error.message}`);
      } else {
        console.log("stdout: ", stdout);
        resolve(stdout);
      }
    });
  });
};

module.exports = execPromise;