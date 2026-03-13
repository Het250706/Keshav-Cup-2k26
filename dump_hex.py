
import sys

def dump_hex(file_path):
    with open(file_path, 'rb') as f:
        content = f.read(100)
    print(content.hex(' '))

if __name__ == "__main__":
    dump_hex(sys.argv[1])
