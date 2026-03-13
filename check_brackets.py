
import sys

def check_brackets(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    stack = []
    for i, char in enumerate(content):
        if char == '{':
            stack.append(('{', i))
        elif char == '}':
            if not stack:
                print(f"Extra '}}' at index {i}")
                return False
            stack.pop()
    
    if stack:
        for char, i in stack:
            print(f"Unclosed '{char}' at index {i}")
        return False
    
    print("All brackets balanced.")
    return True

if __name__ == "__main__":
    check_brackets(sys.argv[1])
